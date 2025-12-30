#!/usr/bin/env python3
"""
GCP Workload Identity Federation 인증 테스트 스크립트 (중앙집중식 지원)

이 스크립트는 AWS EC2에서 GCP 자격증명을 획득하고 인증이 올바르게
작동하는지 테스트합니다. 중앙집중식 WIF와 서비스 계정 impersonation을 지원합니다.

사용법:    
    # 중앙집중식 사용법 (서비스 계정 impersonation)
    ## 전달 받은 JSON 파일 경로
    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/central-credential-config.json
    
    ## 가장할 서비스 계정
    export TARGET_SERVICE_ACCOUNT=target-sa@target-project.iam.gserviceaccount.com
    python3 test_auth.py
    
    ## 가장할 서비스 계정의 프로젝트
    export TARGET_PROJECT_ID=target-project-id
    python3 test_auth.py
"""

import sys
import os
import json
import argparse
import google.auth
import google.auth.transport.requests
from datetime import datetime
from typing import Optional, Tuple, Dict, Any


def print_banner(title):
    """배너 출력 함수"""
    width = 70
    print("=" * width)
    print(f"{title:^{width}}")
    print("=" * width)


def print_section(title):
    """섹션 제목 출력"""
    print(f"\n{'─' * 70}")
    print(f"{title}")
    print('─' * 70)


def check_environment() -> Tuple[bool, Dict[str, Any]]:
    """환경 변수 확인"""
    print_section("1. 환경 변수 확인")
    
    cred_file = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not cred_file:
        print("✗ GOOGLE_APPLICATION_CREDENTIALS 환경 변수가 설정되지 않았습니다.")
        print("\n다음 명령어로 설정하세요:")
        print("  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credential-config.json")
        return False, {}
    
    print(f"✓ GOOGLE_APPLICATION_CREDENTIALS: {cred_file}")
    
    if not os.path.exists(cred_file):
        print(f"✗ 자격증명 파일이 존재하지 않습니다: {cred_file}")
        return False, {}
    
    print(f"✓ 자격증명 파일 존재 확인")
    
    # 중앙집중식 설정 확인
    target_sa = os.environ.get('TARGET_SERVICE_ACCOUNT')
    target_project = os.environ.get('TARGET_PROJECT_ID')
    
    config_info = {}
    
    # 파일 내용 간략히 출력
    try:
        with open(cred_file, 'r') as f:
            config = json.load(f)
        
        print(f"\n자격증명 구성:")
        print(f"  타입: {config.get('type')}")
        print(f"  Audience: {config.get('audience', '')[:60]}...")
        
        if 'service_account_impersonation_url' in config:
            url = config['service_account_impersonation_url']
            # 서비스 계정 이메일 추출
            import re
            match = re.search(r'serviceAccounts/([^:]+):', url)
            if match:
                central_sa = match.group(1)
                print(f"  중앙 서비스 계정: {central_sa}")
                config_info['central_service_account'] = central_sa
        
        # 중앙집중식 모드 확인
        if target_sa:
            print(f"\n중앙집중식 모드:")
            print(f"  타겟 서비스 계정: {target_sa}")
            config_info['target_service_account'] = target_sa
            config_info['is_centralized'] = True
        else:
            print(f"\n직접 모드:")
            print(f"  직접 서비스 계정 사용")
            config_info['is_centralized'] = False
        
        if target_project:
            print(f"  타겟 프로젝트: {target_project}")
            config_info['target_project_id'] = target_project
        
    except Exception as e:
        print(f"⚠ 자격증명 파일 파싱 경고: {e}")
    
    return True, config_info


def test_aws_metadata():
    """AWS 메타데이터 서비스 접근 테스트"""
    print_section("2. AWS 메타데이터 서비스 확인")
    
    try:
        import subprocess
        
        # IMDSv2 토큰 획득
        result = subprocess.run(
            ['curl', '-s', '-X', 'PUT', 
             'http://169.254.169.254/latest/api/token',
             '-H', 'X-aws-ec2-metadata-token-ttl-seconds: 21600'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and result.stdout:
            token = result.stdout
            print(f"✓ IMDSv2 토큰 획득 성공 (길이: {len(token)})")
            
            # IAM Role 정보 확인
            result2 = subprocess.run(
                ['curl', '-s', '-H', f'X-aws-ec2-metadata-token: {token}',
                 'http://169.254.169.254/latest/meta-data/iam/security-credentials/'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result2.returncode == 0 and result2.stdout:
                role_name = result2.stdout.strip()
                print(f"✓ IAM Role: {role_name}")
                return True
            else:
                print("⚠ IAM Role 정보 확인 실패")
                print("  EC2 Instance Profile이 연결되어 있는지 확인하세요.")
                return False
        else:
            print("✗ IMDSv2 토큰 획득 실패")
            print("  AWS EC2 환경에서 실행 중인지 확인하세요.")
            return False
            
    except subprocess.TimeoutExpired:
        print("✗ 메타데이터 서비스 타임아웃")
        print("  AWS EC2 환경이 아니거나 네트워크 문제가 있습니다.")
        return False
    except FileNotFoundError:
        print("⚠ curl 명령어를 찾을 수 없습니다.")
        print("  메타데이터 테스트를 건너뜁니다.")
        return True
    except Exception as e:
        print(f"⚠ 메타데이터 확인 중 오류: {e}")
        return True  # 치명적이지 않으므로 계속 진행


def test_credentials(config_info: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
    """GCP 자격증명 획득 테스트 (중앙집중식 지원)"""
    print_section("3. GCP 자격증명 획득")
    
    try:
        # 기본 자격증명 획득
        credentials, project = google.auth.default(
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        
        print(f"✓ 기본 자격증명 획득 성공")
        print(f"  타입: {type(credentials).__name__}")
        print(f"  프로젝트 ID: {project if project else 'N/A'}")
        
        # 자격증명 세부 정보
        if hasattr(credentials, '_audience'):
            print(f"  Audience: {credentials._audience[:60]}...")
        
        # 중앙집중식 모드인 경우 서비스 계정 impersonation 테스트
        if config_info.get('is_centralized') and config_info.get('target_service_account'):
            print(f"\n중앙집중식 모드: 서비스 계정 impersonation 테스트")
            target_sa = config_info['target_service_account']
            
            try:
                # Impersonation 자격증명 생성
                from google.auth import impersonated_credentials
                
                impersonated_creds = impersonated_credentials.Credentials(
                    source_credentials=credentials,
                    target_principal=target_sa,
                    target_scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                
                print(f"✓ Impersonation 자격증명 생성 성공")
                print(f"  타겟 서비스 계정: {target_sa}")
                
                # Impersonation 토큰 갱신 테스트
                auth_req = google.auth.transport.requests.Request()
                impersonated_creds.refresh(auth_req)
                
                print(f"✓ Impersonation 토큰 갱신 성공")
                
                if impersonated_creds.token:
                    token_preview = impersonated_creds.token[:30] + "..." if len(impersonated_creds.token) > 30 else impersonated_creds.token
                    print(f"  Impersonation 토큰 (일부): {token_preview}")
                
                if impersonated_creds.expiry:
                    print(f"  만료 시간: {impersonated_creds.expiry}")
                    
                    # timezone 처리
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc)
                    
                    if impersonated_creds.expiry.tzinfo is None:
                        expiry_utc = impersonated_creds.expiry.replace(tzinfo=timezone.utc)
                    else:
                        expiry_utc = impersonated_creds.expiry
                    
                    remaining = expiry_utc - now
                    if remaining.total_seconds() > 0:
                        minutes = int(remaining.total_seconds() // 60)
                        seconds = int(remaining.total_seconds() % 60)
                        print(f"  남은 시간: {minutes}분 {seconds}초")
                    else:
                        print(f"  토큰이 만료되었습니다.")
                
                # 타겟 프로젝트 정보
                if config_info.get('target_project_id'):
                    print(f"  타겟 프로젝트: {config_info['target_project_id']}")
                
                return impersonated_creds, config_info.get('target_project_id', project)
                
            except Exception as e:
                print(f"✗ Impersonation 실패: {e}")
                print("\n가능한 원인:")
                print("  - 중앙 서비스 계정에 타겟 SA impersonation 권한 부족")
                print("  - 타겟 서비스 계정이 존재하지 않음")
                print("  - IAM 정책 설정 오류")
                
                # 기본 자격증명으로 계속 진행
                print("\n기본 자격증명으로 계속 진행합니다.")
                return credentials, project
        
        return credentials, project
        
    except Exception as e:
        print(f"✗ 자격증명 획득 실패: {e}")
        print("\n가능한 원인:")
        print("  - GOOGLE_APPLICATION_CREDENTIALS 환경 변수 미설정")
        print("  - 자격증명 파일 형식 오류")
        print("  - AWS IAM Role 미연결")
        return None, None


def test_token_refresh(credentials):
    """토큰 갱신 테스트"""
    print_section("4. 액세스 토큰 갱신")
    
    try:
        auth_req = google.auth.transport.requests.Request()
        credentials.refresh(auth_req)
        
        print(f"✓ 토큰 갱신 성공")
        
        if credentials.token:
            token_preview = credentials.token[:30] + "..." if len(credentials.token) > 30 else credentials.token
            print(f"  토큰 (일부): {token_preview}")
        
        if credentials.expiry:
            print(f"  만료 시간: {credentials.expiry}")
            
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            
            # timezone-aware datetime으로 변환
            if credentials.expiry.tzinfo is None:
                # timezone-naive인 경우 UTC로 가정
                expiry_utc = credentials.expiry.replace(tzinfo=timezone.utc)
            else:
                expiry_utc = credentials.expiry
            
            remaining = expiry_utc - now
            if remaining.total_seconds() > 0:
                minutes = int(remaining.total_seconds() // 60)
                seconds = int(remaining.total_seconds() % 60)
                print(f"  남은 시간: {minutes}분 {seconds}초")
            else:
                print(f"  토큰이 만료되었습니다.")
        
        # 서비스 계정 정보 (있는 경우)
        if hasattr(credentials, '_service_account_email'):
            print(f"  서비스 계정: {credentials._service_account_email}")
        
        return True
        
    except Exception as e:
        print(f"✗ 토큰 갱신 실패: {e}")
        print("\n가능한 원인:")
        print("  - GCP Workload Identity Pool 설정 오류")
        print("  - 서비스 계정 impersonation 권한 부족")
        print("  - AWS 자격증명이 GCP에 등록되지 않음")
        
        import traceback
        print("\n상세 오류:")
        traceback.print_exc()
        
        return False


def test_simple_api_call(credentials, config_info: Dict[str, Any]):
    """간단한 GCP API 호출 테스트 (중앙집중식 지원)"""
    print_section("5. GCP API 호출 테스트 (선택사항)")
    
    try:
        from google.cloud import asset_v1
        
        print("Asset Inventory 클라이언트 생성 중...")
        client = asset_v1.AssetServiceClient(credentials=credentials)
        print("✓ 클라이언트 생성 성공")
        
        # 중앙집중식 모드인 경우 타겟 프로젝트 정보 표시
        if config_info.get('is_centralized'):
            print(f"\n중앙집중식 모드:")
            print(f"  중앙 서비스 계정: {config_info.get('central_service_account', 'N/A')}")
            print(f"  타겟 서비스 계정: {config_info.get('target_service_account', 'N/A')}")
            if config_info.get('target_project_id'):
                print(f"  타겟 프로젝트: {config_info['target_project_id']}")
        
        # 간단한 API 호출은 하지 않음 (권한 문제 가능성)
        print("✓ API 준비 완료")
        print("\n실제 API 호출은 test_asset_inventory.py를 사용하세요.")
        
        return True
        
    except ImportError:
        print("⚠ google-cloud-asset 패키지가 설치되지 않았습니다.")
        print("  pip install google-cloud-asset")
        return True
    except Exception as e:
        print(f"⚠ API 테스트 중 오류: {e}")
        return True  # 선택사항이므로 실패해도 전체 테스트는 성공


def test_organization_asset_inventory(credentials, config_info: Dict[str, Any]):
    """Organization 레벨 Asset Inventory API 테스트"""
    print_section("6. Organization Asset Inventory API 테스트")
    
    try:
        from google.cloud import asset_v1
        
        print("Asset Inventory 클라이언트 생성 중...")
        client = asset_v1.AssetServiceClient(credentials=credentials)
        print("✓ 클라이언트 생성 성공")
        
        # Organization ID 확인
        org_id = os.environ.get('ORGANIZATION_ID')
        if not org_id:
            print("⚠ ORGANIZATION_ID 환경 변수가 설정되지 않았습니다.")
            print("  Organization 레벨 테스트를 건너뜁니다.")
            return True
        
        print(f"✓ Organization ID: {org_id}")
        
        # Organization 리소스 경로
        org_resource = f"organizations/{org_id}"
        
        # 프로젝트 레벨 fallback을 위한 프로젝트 ID 확인
        project_id = config_info.get('target_project_id') or os.environ.get('GOOGLE_CLOUD_PROJECT')
        if not project_id:
            print("⚠ 프로젝트 ID를 찾을 수 없습니다.")
            print("  TARGET_PROJECT_ID 또는 GOOGLE_CLOUD_PROJECT 환경 변수를 설정하세요.")
            return True
        
        print(f"✓ 프로젝트 ID: {project_id}")
        
        # 권한 확인
        print(f"\n권한 확인 중...")
        try:
            # Organization 레벨 권한 확인
            request = asset_v1.SearchAllIamPoliciesRequest(
                scope=org_resource,
                query="policy:roles/owner",
                page_size=1
            )
            client.search_all_iam_policies(request=request)
            print("✓ Organization 레벨 권한 확인됨")
            org_permission = True
        except Exception as e:
            print(f"⚠ Organization 레벨 권한 없음: {e}")
            org_permission = False
        
        try:
            # 프로젝트 레벨 권한 확인
            project_resource = f"projects/{project_id}"
            request = asset_v1.SearchAllIamPoliciesRequest(
                scope=project_resource,
                query="policy:roles/owner",
                page_size=1
            )
            client.search_all_iam_policies(request=request)
            print("✓ 프로젝트 레벨 권한 확인됨")
            project_permission = True
        except Exception as e:
            print(f"⚠ 프로젝트 레벨 권한 없음: {e}")
            project_permission = False
        
        if not org_permission and not project_permission:
            print("✗ Organization과 프로젝트 레벨 모두 권한이 없습니다.")
            print("  Asset Inventory API 테스트를 건너뜁니다.")
            return True
        
        # 1. IAM Policy 검색 테스트
        print(f"\n1. IAM Policy 검색 테스트...")
        try:
            # IAM Policy 검색 요청
            request = asset_v1.SearchAllIamPoliciesRequest(
                scope=org_resource,
                query="policy:roles/owner OR policy:roles/editor",
                page_size=10
            )
            
            print("  IAM Policy 검색 중...")
            response = client.search_all_iam_policies(request=request)
            
            policy_count = 0
            for policy in response:
                policy_count += 1
                if policy_count <= 3:  # 처음 3개만 상세 출력
                    print(f"\n  Policy #{policy_count}:")
                    print(f"    리소스: {policy.resource}")
                    print(f"    프로젝트: {policy.project}")
                    # IAM Policy 정보 출력
                    if hasattr(policy, 'policy') and policy.policy:
                        if hasattr(policy.policy, 'policy') and policy.policy.policy:
                            print(f"    정책: {policy.policy.policy.name if hasattr(policy.policy.policy, 'name') else 'N/A'}")
                            
                            # 바인딩 정보
                            if hasattr(policy.policy.policy, 'bindings') and policy.policy.policy.bindings:
                                print(f"    바인딩 수: {len(policy.policy.policy.bindings)}")
                                for i, binding in enumerate(policy.policy.policy.bindings[:2]):  # 처음 2개만
                                    print(f"      바인딩 {i+1}: {binding.role}")
                                    if hasattr(binding, 'members') and binding.members:
                                        print(f"        멤버: {', '.join(binding.members[:3])}")  # 처음 3개만
                                        if len(binding.members) > 3:
                                            print(f"        ... 외 {len(binding.members) - 3}개")
                        else:
                            print(f"    정책: N/A (정책 정보 없음)")
                    else:
                        print(f"    정책: N/A (정책 정보 없음)")
            
            if policy_count > 3:
                print(f"\n  ... 외 {policy_count - 3}개 정책 더 있음")
            
            print(f"✓ IAM Policy 검색 성공 (총 {policy_count}개 정책)")
            
        except Exception as e:
            print(f"✗ Organization IAM Policy 검색 실패: {e}")
            print("  Organization 레벨 권한이 없습니다. 프로젝트 레벨로 fallback합니다.")
            
            # 프로젝트 레벨 IAM Policy 검색
            try:
                print(f"\n  프로젝트 레벨 IAM Policy 검색 시도...")
                project_resource = f"projects/{project_id}"
                
                request = asset_v1.SearchAllIamPoliciesRequest(
                    scope=project_resource,
                    query="policy:roles/owner OR policy:roles/editor",
                    page_size=10
                )
                
                print("  프로젝트 IAM Policy 검색 중...")
                response = client.search_all_iam_policies(request=request)
                
                policy_count = 0
                for policy in response:
                    policy_count += 1
                    if policy_count <= 3:
                        print(f"\n  프로젝트 Policy #{policy_count}:")
                        print(f"    리소스: {policy.resource}")
                        print(f"    프로젝트: {policy.project}")
                        # IAM Policy 정보 출력
                        if hasattr(policy, 'policy') and policy.policy:
                            if hasattr(policy.policy, 'policy') and policy.policy.policy:
                                print(f"    정책: {policy.policy.policy.name if hasattr(policy.policy.policy, 'name') else 'N/A'}")
                                
                                if hasattr(policy.policy.policy, 'bindings') and policy.policy.policy.bindings:
                                    print(f"    바인딩 수: {len(policy.policy.policy.bindings)}")
                                    for i, binding in enumerate(policy.policy.policy.bindings[:2]):
                                        print(f"      바인딩 {i+1}: {binding.role}")
                                        if hasattr(binding, 'members') and binding.members:
                                            print(f"        멤버: {', '.join(binding.members[:3])}")
                                            if len(binding.members) > 3:
                                                print(f"        ... 외 {len(binding.members) - 3}개")
                            else:
                                print(f"    정책: N/A (정책 정보 없음)")
                        else:
                            print(f"    정책: N/A (정책 정보 없음)")
                
                if policy_count > 3:
                    print(f"\n  ... 외 {policy_count - 3}개 정책 더 있음")
                
                print(f"✓ 프로젝트 IAM Policy 검색 성공 (총 {policy_count}개 정책)")
                
            except Exception as e2:
                print(f"✗ 프로젝트 IAM Policy 검색도 실패: {e2}")
                print("  프로젝트 레벨 권한도 부족합니다.")
        
        # 2. 리소스 검색 테스트
        print(f"\n2. 리소스 검색 테스트...")
        try:
            # 리소스 검색 요청
            request = asset_v1.SearchAllResourcesRequest(
                scope=org_resource,
                asset_types=["cloudresourcemanager.googleapis.com/Project"],
                page_size=10
            )
            
            print("  프로젝트 리소스 검색 중...")
            response = client.search_all_resources(request=request)
            
            project_count = 0
            for resource in response:
                project_count += 1
                if project_count <= 3:  # 처음 3개만 상세 출력
                    print(f"\n  프로젝트 #{project_count}:")
                    print(f"    이름: {resource.name}")
                    print(f"    프로젝트 ID: {resource.project}")
                    print(f"    타입: {resource.asset_type}")
                    
                    # 추가 속성
                    if hasattr(resource, 'resource') and resource.resource:
                        if hasattr(resource.resource, 'data') and resource.resource.data:
                            data = resource.resource.data
                            if 'projectId' in data:
                                print(f"    프로젝트 ID: {data['projectId']}")
                            if 'displayName' in data:
                                print(f"    표시 이름: {data['displayName']}")
            
            if project_count > 3:
                print(f"\n  ... 외 {project_count - 3}개 프로젝트 더 있음")
            
            print(f"✓ 리소스 검색 성공 (총 {project_count}개 프로젝트)")
            
        except Exception as e:
            print(f"✗ Organization 리소스 검색 실패: {e}")
            print("  Organization 레벨 권한이 없습니다. 프로젝트 레벨로 fallback합니다.")
            
            # 프로젝트 레벨 리소스 검색
            try:
                print(f"\n  프로젝트 레벨 리소스 검색 시도...")
                project_resource = f"projects/{project_id}"
                
                request = asset_v1.SearchAllResourcesRequest(
                    scope=project_resource,
                    asset_types=["cloudresourcemanager.googleapis.com/Project"],
                    page_size=10
                )
                
                print("  프로젝트 리소스 검색 중...")
                response = client.search_all_resources(request=request)
                
                project_count = 0
                for resource in response:
                    project_count += 1
                    if project_count <= 3:
                        print(f"\n  프로젝트 리소스 #{project_count}:")
                        print(f"    이름: {resource.name}")
                        print(f"    프로젝트 ID: {resource.project}")
                        print(f"    타입: {resource.asset_type}")
                        
                        if hasattr(resource, 'resource') and resource.resource:
                            if hasattr(resource.resource, 'data') and resource.resource.data:
                                data = resource.resource.data
                                if 'projectId' in data:
                                    print(f"    프로젝트 ID: {data['projectId']}")
                                if 'displayName' in data:
                                    print(f"    표시 이름: {data['displayName']}")
                
                if project_count > 3:
                    print(f"\n  ... 외 {project_count - 3}개 리소스 더 있음")
                
                print(f"✓ 프로젝트 리소스 검색 성공 (총 {project_count}개 리소스)")
                
            except Exception as e2:
                print(f"✗ 프로젝트 리소스 검색도 실패: {e2}")
                print("  프로젝트 레벨 권한도 부족합니다.")
        
        # 3. 특정 서비스 계정 IAM Policy 검색
        if config_info.get('target_service_account'):
            print(f"\n3. 특정 서비스 계정 IAM Policy 검색...")
            target_sa = config_info['target_service_account']
            
            try:
                # 특정 서비스 계정 관련 IAM Policy 검색
                request = asset_v1.SearchAllIamPoliciesRequest(
                    scope=org_resource,
                    query=f"policy:{target_sa}",
                    page_size=5
                )
                
                print(f"  서비스 계정 '{target_sa}' 관련 정책 검색 중...")
                response = client.search_all_iam_policies(request=request)
                
                sa_policy_count = 0
                for policy in response:
                    sa_policy_count += 1
                    print(f"\n  서비스 계정 정책 #{sa_policy_count}:")
                    print(f"    리소스: {policy.resource}")
                    print(f"    프로젝트: {policy.project}")
                    
                    if hasattr(policy, 'policy') and policy.policy:
                        if hasattr(policy.policy, 'policy') and policy.policy.policy:
                            if hasattr(policy.policy.policy, 'bindings') and policy.policy.policy.bindings:
                                for binding in policy.policy.policy.bindings:
                                    if hasattr(binding, 'members') and binding.members and target_sa in binding.members:
                                        print(f"    역할: {binding.role}")
                                        print(f"    멤버: {', '.join(binding.members)}")
                
                if sa_policy_count == 0:
                    print("  해당 서비스 계정에 대한 IAM 정책을 찾을 수 없습니다.")
                else:
                    print(f"✓ 서비스 계정 IAM Policy 검색 성공 (총 {sa_policy_count}개 정책)")
                
            except Exception as e:
                print(f"✗ Organization 서비스 계정 IAM Policy 검색 실패: {e}")
                print("  Organization 레벨 권한이 없습니다. 프로젝트 레벨로 fallback합니다.")
                
                # 프로젝트 레벨 서비스 계정 IAM Policy 검색
                try:
                    print(f"\n  프로젝트 레벨 서비스 계정 IAM Policy 검색 시도...")
                    project_resource = f"projects/{project_id}"
                    
                    request = asset_v1.SearchAllIamPoliciesRequest(
                        scope=project_resource,
                        query=f"policy:{target_sa}",
                        page_size=5
                    )
                    
                    print(f"  프로젝트에서 서비스 계정 '{target_sa}' 관련 정책 검색 중...")
                    response = client.search_all_iam_policies(request=request)
                    
                    sa_policy_count = 0
                    for policy in response:
                        sa_policy_count += 1
                        print(f"\n  프로젝트 서비스 계정 정책 #{sa_policy_count}:")
                        print(f"    리소스: {policy.resource}")
                        print(f"    프로젝트: {policy.project}")
                        
                        if hasattr(policy, 'policy') and policy.policy:
                            if hasattr(policy.policy, 'policy') and policy.policy.policy:
                                if hasattr(policy.policy.policy, 'bindings') and policy.policy.policy.bindings:
                                    for binding in policy.policy.policy.bindings:
                                        if hasattr(binding, 'members') and binding.members and target_sa in binding.members:
                                            print(f"    역할: {binding.role}")
                                            print(f"    멤버: {', '.join(binding.members)}")
                    
                    if sa_policy_count == 0:
                        print("  해당 서비스 계정에 대한 프로젝트 IAM 정책을 찾을 수 없습니다.")
                    else:
                        print(f"✓ 프로젝트 서비스 계정 IAM Policy 검색 성공 (총 {sa_policy_count}개 정책)")
                
                except Exception as e2:
                    print(f"✗ 프로젝트 서비스 계정 IAM Policy 검색도 실패: {e2}")
                    print("  프로젝트 레벨 권한도 부족합니다.")
        
        return True
        
    except ImportError:
        print("⚠ google-cloud-asset 패키지가 설치되지 않았습니다.")
        print("  pip install google-cloud-asset")
        return True
    except Exception as e:
        print(f"⚠ Organization Asset Inventory 테스트 중 오류: {e}")
        return True  # 선택사항이므로 실패해도 전체 테스트는 성공


def parse_arguments():
    """명령행 인수 파싱"""
    parser = argparse.ArgumentParser(
        description="GCP Workload Identity Federation 인증 테스트 (중앙집중식 지원)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  # 기본 사용법
  python3 test_auth.py
  
  # 중앙집중식 사용법
  export TARGET_SERVICE_ACCOUNT=target-sa@target-project.iam.gserviceaccount.com
  python3 test_auth.py
  
  # 특정 프로젝트 지정
  export TARGET_PROJECT_ID=target-project-id
  python3 test_auth.py
  
  # Organization Asset Inventory API 테스트
  export ORGANIZATION_ID=123456789012
  python3 test_auth.py
  
  # 모든 옵션 함께 사용
  python3 test_auth.py \\
    --target-service-account=target-sa@target-project.iam.gserviceaccount.com \\
    --target-project-id=target-project-id \\
    --organization-id=123456789012
        """
    )
    
    parser.add_argument(
        '--target-service-account',
        help='타겟 서비스 계정 (중앙집중식 모드)',
        default=os.environ.get('TARGET_SERVICE_ACCOUNT')
    )
    
    parser.add_argument(
        '--target-project-id',
        help='타겟 프로젝트 ID',
        default=os.environ.get('TARGET_PROJECT_ID')
    )
    
    parser.add_argument(
        '--organization-id',
        help='Organization ID (Asset Inventory API 테스트용)',
        default=os.environ.get('ORGANIZATION_ID')
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='상세 출력'
    )
    
    return parser.parse_args()


def main():
    """메인 함수"""
    args = parse_arguments()
    
    # 환경 변수 설정 (명령행 인수가 있으면 우선 적용)
    if args.target_service_account:
        os.environ['TARGET_SERVICE_ACCOUNT'] = args.target_service_account
    if args.target_project_id:
        os.environ['TARGET_PROJECT_ID'] = args.target_project_id
    if args.organization_id:
        os.environ['ORGANIZATION_ID'] = args.organization_id
    
    print_banner("GCP Workload Identity Federation 인증 테스트 (중앙집중식 지원)")
    print(f"\n실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python 버전: {sys.version.split()[0]}")
    
    # 테스트 실행
    success = True
    
    # 1. 환경 변수 확인
    env_ok, config_info = check_environment()
    if not env_ok:
        success = False
        print_banner("✗ 테스트 실패")
        return 1
    
    # 2. AWS 메타데이터 확인 (선택사항)
    test_aws_metadata()
    
    # 3. 자격증명 획득 (중앙집중식 지원)
    credentials, project = test_credentials(config_info)
    if not credentials:
        success = False
        print_banner("✗ 테스트 실패")
        return 1
    
    # 4. 토큰 갱신
    if not test_token_refresh(credentials):
        success = False
        print_banner("✗ 테스트 실패")
        return 1
    
    # 5. API 준비 확인 (중앙집중식 지원)
    test_simple_api_call(credentials, config_info)
    
    # 6. Organization Asset Inventory API 테스트
    test_organization_asset_inventory(credentials, config_info)
    
    # 최종 결과
    print_section("테스트 결과")
    if success:
        print("\n✓ 모든 테스트 통과!")
        
        if config_info.get('is_centralized'):
            print("\n중앙집중식 모드 설정:")
            print(f"  중앙 서비스 계정: {config_info.get('central_service_account', 'N/A')}")
            print(f"  타겟 서비스 계정: {config_info.get('target_service_account', 'N/A')}")
            if config_info.get('target_project_id'):
                print(f"  타겟 프로젝트: {config_info['target_project_id']}")
        
        print("\n다음 단계:")
        print("  1. test_asset_inventory.py로 실제 API 호출 테스트")
        print("  2. 애플리케이션에 통합")
        print_banner("✓ 테스트 성공")
        return 0
    else:
        print("\n✗ 일부 테스트 실패")
        print("\n문제 해결:")
        print("  1. 03-통합-테스트-가이드.md의 트러블슈팅 섹션 참고")
        print("  2. 04-중앙집중식-WIF-관리-가이드.md 참고 (중앙집중식 모드)")
        print("  3. debug_credentials.py 실행")
        print_banner("✗ 테스트 실패")
        return 1


if __name__ == "__main__":
    sys.exit(main())

