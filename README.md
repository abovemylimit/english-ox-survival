# ENGLISH QUIZ SURVIVAL

실시간 영어 OX 서바이벌 게임 (Node.js + Socket.IO). 30명 동시 접속 상한, PC 방향키/WASD, 모바일 방향 버튼, 교사용 관리자, 전자칠판, OX 탈락 판정.

## 로컬 실행
1. Node.js 20 이상 설치
2. 이 폴더에서 `npm install`
3. 관리자 PIN 설정 후 실행:
   - macOS/Linux: `TEACHER_PIN=원하는비밀번호 npm start`
   - Windows PowerShell: `$env:TEACHER_PIN="원하는비밀번호"; npm start`
4. 학생: `http://localhost:3000/`
5. 전자칠판: `http://localhost:3000/screen.html`
6. 관리자: `http://localhost:3000/teacher.html`

## 인터넷 배포 (Render 예시)
1. GitHub에 이 프로젝트를 업로드합니다.
2. Render.com > New > Web Service > GitHub 저장소 연결
3. Build Command: `npm install`; Start Command: `npm start`
4. Environment 변수 `TEACHER_PIN`을 강력한 임의 비밀번호로 설정합니다.
5. 인스턴스 1개로 운영합니다. 공개된 https 주소가 학생 입장 주소입니다.
6. 관리자 페이지에서 문제를 등록하고 전자칠판 페이지를 띄웁니다.

## 수업 전 유의사항
- 이 버전은 단일 서버 메모리에 상태를 보관합니다. 서버가 재시작되면 게임과 문제 데이터가 초기화됩니다.
- 프로덕션용 보안/영속 저장/복구/운영 모니터링을 갖춘 서비스가 아니라 수업용 MVP입니다.
- 학교 Wi-Fi에서 학생 30명 접속을 사전 테스트하세요.
- 학생 닉네임은 실명 대신 별명을 권장합니다.
- QR 코드는 CDN 접근이 가능할 때 표시됩니다. 접속 주소도 항상 화면에 표시됩니다.
- 탈락한 학생은 관전하고, 교사는 '전체 부활'로 복귀시킬 수 있습니다.
- 교사용 PIN은 서버 환경변수로 설정하며, 기본값 1234는 테스트 전용입니다.
