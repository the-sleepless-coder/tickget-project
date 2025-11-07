# #!/usr/bin/env bash
# set -e  # 오류 발생 시 즉시 종료

# # 1) DB 초기화
# python - <<'PY'
# from captcha_api.app import create_app, db
# app = create_app()
# with app.app_context():
#     db.create_all()
#     print("✅ captcha.db 초기화/마이그레이션(빈 테이블이면 생성)")
# PY

# # 2) 서버 시작 (Flask or Gunicorn)
# exec gunicorn -b 0.0.0.0:8080 'captcha_api.app:create_app()'

