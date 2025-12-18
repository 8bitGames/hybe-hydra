"use client";

import { useI18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Mail, Trash2, Shield, Database } from "lucide-react";

export default function FacebookDataDeletionPage() {
  const { language } = useI18n();
  const isKorean = language === "ko";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {isKorean ? "Facebook 데이터 삭제 안내" : "Facebook Data Deletion"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isKorean
            ? "Facebook 계정과 관련된 데이터 삭제 방법을 안내합니다."
            : "Learn how to delete data associated with your Facebook account."}
        </p>
      </div>

      {/* What data we collect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {isKorean ? "저장되는 데이터" : "Data We Collect"}
          </CardTitle>
          <CardDescription>
            {isKorean
              ? "Facebook/Instagram 연결 시 저장되는 정보"
              : "Information stored when connecting Facebook/Instagram"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              {isKorean
                ? "Facebook/Instagram 계정 ID 및 사용자 이름"
                : "Facebook/Instagram account ID and username"}
            </li>
            <li>
              {isKorean
                ? "액세스 토큰 (API 연동용)"
                : "Access tokens (for API integration)"}
            </li>
            <li>
              {isKorean
                ? "연결된 페이지/계정 정보"
                : "Connected pages/accounts information"}
            </li>
            <li>
              {isKorean
                ? "게시물 업로드 기록"
                : "Post upload history"}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* How to delete data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {isKorean ? "데이터 삭제 방법" : "How to Delete Your Data"}
          </CardTitle>
          <CardDescription>
            {isKorean
              ? "아래 방법 중 하나를 선택하여 데이터를 삭제할 수 있습니다."
              : "You can delete your data using one of the following methods."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Method 1 */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                1
              </span>
              {isKorean ? "앱 내에서 직접 삭제" : "Delete within the App"}
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-8">
              <li>
                {isKorean
                  ? "설정 > 계정 연결 페이지로 이동합니다."
                  : "Go to Settings > Connected Accounts."}
              </li>
              <li>
                {isKorean
                  ? "연결된 Facebook/Instagram 계정을 찾습니다."
                  : "Find your connected Facebook/Instagram account."}
              </li>
              <li>
                {isKorean
                  ? "'연결 해제' 버튼을 클릭합니다."
                  : "Click the 'Disconnect' button."}
              </li>
              <li>
                {isKorean
                  ? "연결 해제 시 모든 관련 데이터가 자동으로 삭제됩니다."
                  : "All related data will be automatically deleted upon disconnection."}
              </li>
            </ol>
          </div>

          {/* Method 2 */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                2
              </span>
              {isKorean ? "이메일로 삭제 요청" : "Request Deletion via Email"}
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              {isKorean
                ? "아래 이메일로 데이터 삭제를 요청할 수 있습니다:"
                : "You can request data deletion by emailing:"}
            </p>
            <div className="ml-8 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a
                href="mailto:cto@modawn.ai"
                className="text-primary hover:underline"
              >
                cto@modawn.ai
              </a>
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              {isKorean
                ? "이메일에 다음 정보를 포함해 주세요:"
                : "Please include the following information in your email:"}
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground ml-12">
              <li>
                {isKorean
                  ? "Facebook/Instagram 사용자 이름 또는 ID"
                  : "Facebook/Instagram username or ID"}
              </li>
              <li>
                {isKorean
                  ? "가입 시 사용한 이메일 주소"
                  : "Email address used for registration"}
              </li>
              <li>
                {isKorean
                  ? "삭제 요청 사유 (선택사항)"
                  : "Reason for deletion request (optional)"}
              </li>
            </ul>
          </div>

          {/* Method 3 */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                3
              </span>
              {isKorean ? "Facebook에서 앱 제거" : "Remove App from Facebook"}
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-8">
              <li>
                {isKorean
                  ? "Facebook 설정 > 앱 및 웹사이트로 이동합니다."
                  : "Go to Facebook Settings > Apps and Websites."}
              </li>
              <li>
                {isKorean
                  ? "Hybe Hydra 앱을 찾아 '제거' 버튼을 클릭합니다."
                  : "Find Hybe Hydra app and click 'Remove'."}
              </li>
              <li>
                {isKorean
                  ? "'이 앱이 게시한 모든 게시물 삭제' 옵션을 선택합니다."
                  : "Select 'Delete all posts this app made on your behalf'."}
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isKorean ? "데이터 보존 정책" : "Data Retention Policy"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isKorean
              ? "데이터 삭제 요청 후 30일 이내에 모든 관련 데이터가 영구적으로 삭제됩니다. 삭제되는 데이터에는 다음이 포함됩니다:"
              : "All related data will be permanently deleted within 30 days of your deletion request. Deleted data includes:"}
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              {isKorean
                ? "계정 연결 정보 및 액세스 토큰"
                : "Account connection information and access tokens"}
            </li>
            <li>
              {isKorean
                ? "업로드 기록 및 게시물 메타데이터"
                : "Upload history and post metadata"}
            </li>
            <li>
              {isKorean
                ? "사용자 기본 설정 및 환경 설정"
                : "User preferences and settings"}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>
          {isKorean ? "추가 문의" : "Additional Questions"}
        </AlertTitle>
        <AlertDescription>
          {isKorean
            ? "데이터 삭제와 관련하여 추가 질문이 있으시면 cto@modawn.ai으로 연락해 주세요. 영업일 기준 2-3일 이내에 답변 드리겠습니다."
            : "If you have additional questions about data deletion, please contact us at cto@modawn.ai. We will respond within 2-3 business days."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
