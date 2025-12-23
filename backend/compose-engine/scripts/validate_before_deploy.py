#!/usr/bin/env python3
"""
Pre-deployment validation script.
Run this BEFORE `modal deploy` to catch errors early.

Usage:
    python3 scripts/validate_before_deploy.py
"""

import sys
import ast
import importlib.util
from pathlib import Path


def check_python_syntax(directory: Path) -> list[str]:
    """Check all Python files for syntax errors."""
    errors = []
    for py_file in directory.rglob("*.py"):
        if "__pycache__" in str(py_file):
            continue
        try:
            with open(py_file) as f:
                source = f.read()
            ast.parse(source)
            print(f"  ✓ {py_file.relative_to(directory)}")
        except SyntaxError as e:
            errors.append(f"{py_file}: {e}")
            print(f"  ✗ {py_file.relative_to(directory)}: {e}")
    return errors


def check_dockerfile(dockerfile: Path) -> list[str]:
    """Basic Dockerfile validation."""
    errors = []
    if not dockerfile.exists():
        errors.append(f"Dockerfile not found: {dockerfile}")
        return errors

    content = dockerfile.read_text()
    lines = content.split("\n")

    # Check for common issues
    has_from = any(line.strip().startswith("FROM") for line in lines)
    if not has_from:
        errors.append("Dockerfile missing FROM instruction")

    # Check for MoviePy 2.x import issues
    if "moviepy.editor" in content:
        errors.append("Dockerfile uses 'moviepy.editor' - MoviePy 2.x uses 'from moviepy import ...'")

    # Check for proper ENV syntax
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("ENV ") and "=" not in stripped and len(stripped.split()) == 2:
            errors.append(f"Line {i}: ENV without value assignment")

    if not errors:
        print(f"  ✓ Dockerfile syntax OK")
    else:
        for err in errors:
            print(f"  ✗ {err}")

    return errors


def check_local_imports() -> list[str]:
    """Check if common imports work locally (non-GPU packages)."""
    errors = []
    packages = [
        "numpy",
        "PIL",
        "boto3",
        "httpx",
        "pydantic",
        "fastapi",
    ]

    for pkg in packages:
        try:
            __import__(pkg)
            print(f"  ✓ {pkg}")
        except ImportError as e:
            # Not an error - these might not be installed locally
            print(f"  ⚠ {pkg}: not installed locally (OK)")

    return errors


def check_app_imports(app_dir: Path) -> list[str]:
    """Check that app module structure is valid."""
    errors = []

    # Check for __init__.py files
    required_inits = [
        app_dir / "__init__.py",
        app_dir / "services" / "__init__.py",
        app_dir / "models" / "__init__.py",
        app_dir / "effects" / "__init__.py",
    ]

    for init_file in required_inits:
        if init_file.exists():
            print(f"  ✓ {init_file.relative_to(app_dir.parent)}")
        else:
            # Not necessarily an error in Python 3.3+
            print(f"  ⚠ {init_file.relative_to(app_dir.parent)} missing (namespace package)")

    return errors


def main():
    print("=" * 60)
    print("PRE-DEPLOYMENT VALIDATION")
    print("=" * 60)

    base_dir = Path(__file__).parent.parent
    app_dir = base_dir / "app"
    dockerfile = base_dir / "Dockerfile"

    all_errors = []

    print("\n1. Checking Dockerfile...")
    all_errors.extend(check_dockerfile(dockerfile))

    print("\n2. Checking Python syntax...")
    all_errors.extend(check_python_syntax(app_dir))

    print("\n3. Checking app structure...")
    all_errors.extend(check_app_imports(app_dir))

    print("\n4. Checking local imports (optional)...")
    check_local_imports()

    print("\n" + "=" * 60)
    if all_errors:
        print("VALIDATION FAILED")
        print("=" * 60)
        for err in all_errors:
            print(f"  ✗ {err}")
        return 1
    else:
        print("VALIDATION PASSED")
        print("=" * 60)
        print("Ready to deploy: modal deploy modal_app.py")
        return 0


if __name__ == "__main__":
    sys.exit(main())
