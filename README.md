# Batt - Công Cụ Tạo Commit Message Bằng AI

Công cụ CLI Node.js sẵn sàng cho production, tạo commit message theo chuẩn Conventional Commits bằng AI. Batt phân tích các thay đổi git đã được stage và đề xuất commit message tuân theo đặc tả Conventional Commits.

## 🚀 Quick Start

```bash
# Cài đặt
npm install -g battery-generate-commit

# Thiết lập API key
batt setup

# Sử dụng
git add .
batt -gen commit
```

## Tính Năng

- 🤖 **Hỗ trợ AI**: Hỗ trợ nhiều nhà cung cấp AI (Groq, Google Gemini, OpenAI ChatGPT, Anthropic Claude) để tạo commit message thông minh
- 📝 **Conventional Commits**: Tự động định dạng message theo chuẩn Conventional Commits
- ⚙️ **Có thể cấu hình**: Cấu hình theo từng dự án qua file `.batt/config.json`, bao gồm chọn nhà cung cấp AI
- 🔒 **An toàn**: Luôn hỏi xác nhận trước khi commit
- 🚀 **Nhanh**: Thời gian phản hồi nhanh với các API hiện đại
- 🌍 **Đa nền tảng**: Hoạt động trên macOS, Linux và Windows

## Cài Đặt

### Yêu Cầu

- Node.js 18.0.0 trở lên
- Git đã được cài đặt và cấu hình
- API key từ một trong các nhà cung cấp:
  - **Groq** API key ([Lấy tại đây](https://console.groq.com/)) - Khuyên dùng (miễn phí, nhanh)
  - **Google Gemini** API key ([Lấy tại đây](https://makersuite.google.com/app/apikey))
  - **OpenAI (ChatGPT)** API key ([Lấy tại đây](https://platform.openai.com/api-keys))
  - **Anthropic (Claude)** API key ([Lấy tại đây](https://console.anthropic.com/))

### Cài Đặt Dependencies

```bash
npm install
```

### Cài Đặt Toàn Cục (Global Installation)

Có 2 cách để sử dụng `batt` toàn cục:

#### Cách 1: npm link (Cho Development)

Để phát triển và test local, sử dụng `npm link`:

```bash
npm link
```

Lệnh này sẽ tạo symbolic link, làm cho lệnh `batt` có sẵn toàn cục trên hệ thống của bạn.

#### Cách 2: Cài đặt từ npm (Khuyên dùng)

Nếu package đã được publish lên npm registry:

```bash
npm install -g battery-generate-commit
```

Sau khi cài đặt, bạn có thể sử dụng lệnh `batt`:

```bash
batt -gen commit
```

Hoặc cài đặt từ thư mục local:

```bash
npm install -g .
```

**Lưu ý**: 
- Package name trên npm: `battery-generate-commit`
- Lệnh CLI sau khi cài đặt: `batt`
- Sau khi cài đặt, bạn có thể chạy `batt -gen commit` từ bất kỳ thư mục nào trong terminal.

### Thiết Lập API Key Sau Khi Cài Đặt

Sau khi cài đặt, chạy lệnh setup để nhập API key:

```bash
batt setup
```

Lệnh này sẽ hướng dẫn bạn:
1. Chọn nhà cung cấp AI (Groq, Gemini, OpenAI, Claude, hoặc Tất cả)
2. Nhập API key
3. Tự động thêm vào shell profile của bạn

Hoặc bạn có thể thiết lập thủ công như mô tả ở phần [Thiết Lập API Key](#thiết-lập-api-key).

### Thiết Lập API Key

Batt hỗ trợ nhiều nhà cung cấp AI: **Groq** (mặc định), **Gemini**, **OpenAI (ChatGPT)**, và **Claude (Anthropic)**. Bạn cần thiết lập API key cho nhà cung cấp bạn muốn sử dụng.

#### Groq API Key (Mặc định)

```bash
# macOS/Linux
export BATT_GROQ_API_KEY=your_groq_api_key_here

# Windows (PowerShell)
$env:BATT_GROQ_API_KEY="your_groq_api_key_here"

# Windows (CMD)
set BATT_GROQ_API_KEY=your_groq_api_key_here
```

#### Gemini API Key

```bash
# macOS/Linux
export BATT_GEMINI_API_KEY=your_gemini_api_key_here

# Windows (PowerShell)
$env:BATT_GEMINI_API_KEY="your_gemini_api_key_here"

# Windows (CMD)
set BATT_GEMINI_API_KEY=your_gemini_api_key_here
```

Để làm cho nó vĩnh viễn, thêm vào shell profile của bạn (`~/.zshrc`, `~/.bashrc`, v.v.):

```bash
# Cho Groq
echo 'export BATT_GROQ_API_KEY=your_groq_api_key_here' >> ~/.zshrc

# Hoặc cho Gemini
echo 'export BATT_GEMINI_API_KEY=your_gemini_api_key_here' >> ~/.zshrc

# Hoặc cho OpenAI
echo 'export BATT_OPENAI_API_KEY=your_openai_api_key_here' >> ~/.zshrc

# Hoặc cho Claude
echo 'export BATT_ANTHROPIC_API_KEY=your_anthropic_api_key_here' >> ~/.zshrc

source ~/.zshrc
```

#### OpenAI (ChatGPT) API Key

```bash
# macOS/Linux
export BATT_OPENAI_API_KEY=your_openai_api_key_here
# Hoặc sử dụng biến môi trường chuẩn
export OPENAI_API_KEY=your_openai_api_key_here

# Windows (PowerShell)
$env:BATT_OPENAI_API_KEY="your_openai_api_key_here"

# Windows (CMD)
set BATT_OPENAI_API_KEY=your_openai_api_key_here
```

**Lấy API key tại**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

#### Claude (Anthropic) API Key

```bash
# macOS/Linux
export BATT_ANTHROPIC_API_KEY=your_anthropic_api_key_here
# Hoặc sử dụng biến môi trường chuẩn
export ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Windows (PowerShell)
$env:BATT_ANTHROPIC_API_KEY="your_anthropic_api_key_here"

# Windows (CMD)
set BATT_ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Lấy API key tại**: [https://console.anthropic.com/](https://console.anthropic.com/)

**Lưu ý**: 
- Bạn chỉ cần thiết lập API key cho nhà cung cấp bạn muốn sử dụng
- OpenAI và Claude cũng hỗ trợ biến môi trường chuẩn (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Xem phần [Cấu Hình](#cấu-hình) để chọn nhà cung cấp

## Cách Sử Dụng

### Sử Dụng Cơ Bản

1. Stage các thay đổi của bạn:
   ```bash
   git add <files>
   # hoặc
   git add .
   ```

2. Tạo và commit:
   ```bash
   batt -gen commit
   ```

   Hoặc sử dụng cú pháp thay thế:
   ```bash
   batt gen commit
   ```

3. Xem lại message đã tạo và xác nhận:
   ```
   ✅ Commit message generated!

   Generated commit message:
     feat: add user authentication module

   Commit with this message? (Y/n):
   ```

4. Gõ `Y` hoặc nhấn Enter để commit, hoặc `n` để hủy.

### Ví Dụ Workflow

```bash
# Thực hiện một số thay đổi trong code
vim src/auth.js

# Stage các thay đổi
git add src/auth.js

# Tạo commit message
batt -gen commit

# Xem lại và xác nhận
# ✅ Changes committed successfully!
```

## Cấu Hình

Tạo file `.batt/config.json` trong thư mục gốc của dự án để tùy chỉnh hành vi:

```json
{
  "aiProvider": "groq",
  "maxTitleLength": 72,
  "confirmBeforeCommit": true,
  "allowedTypes": ["feat", "fix", "refactor", "chore", "test"]
}
```

### Tùy Chọn Cấu Hình

| Tùy chọn | Kiểu | Mặc định | Mô tả |
|----------|------|----------|-------|
| `aiProvider` | string | `"groq"` | Nhà cung cấp AI để sử dụng (`groq`, `gemini`, `openai`, `claude`) |
| `maxTitleLength` | number | `72` | Độ dài tối đa của tiêu đề commit message |
| `confirmBeforeCommit` | boolean | `true` | Có hỏi xác nhận trước khi commit hay không |
| `allowedTypes` | string[] | `["feat","fix","refactor","chore","test"]` | Các loại Conventional Commit được phép |

### Ví Dụ Cấu Hình

**Sử dụng Groq (mặc định):**
```json
{
  "aiProvider": "groq",
  "maxTitleLength": 72,
  "confirmBeforeCommit": true
}
```

**Sử dụng Gemini:**
```json
{
  "aiProvider": "gemini",
  "maxTitleLength": 72,
  "confirmBeforeCommit": true
}
```

**Sử dụng OpenAI (ChatGPT):**
```json
{
  "aiProvider": "openai",
  "maxTitleLength": 72,
  "confirmBeforeCommit": true
}
```

**Sử dụng Claude:**
```json
{
  "aiProvider": "claude",
  "maxTitleLength": 72,
  "confirmBeforeCommit": true
}
```

**Tùy chỉnh khác:**
```json
{
  "maxTitleLength": 50,
  "confirmBeforeCommit": false,
  "allowedTypes": ["feat", "fix", "chore"]
}
```

## Định Dạng Commit Message

Batt tạo commit message theo đặc tả [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>
<footer>
```

### Các Loại

- `feat`: Tính năng mới
- `fix`: Sửa lỗi
- `refactor`: Tái cấu trúc code
- `chore`: Các tác vụ bảo trì
- `test`: Thêm hoặc cập nhật test

### Ví Dụ

- `feat: add user login functionality`
- `fix: resolve memory leak in data processor`
- `refactor: simplify authentication logic`
- `chore: update dependencies`
- `test: add unit tests for user service`

## Xử Lý Lỗi

### Không Có Thay Đổi Đã Stage

Nếu bạn chạy `batt -gen commit` mà không có thay đổi nào được stage:

```
⚠️  No staged changes found.
ℹ️  Stage your changes first with: git add <files>
```

### Thiếu API Key

Nếu API key chưa được thiết lập cho nhà cung cấp đã chọn:

**Cho Groq:**
```
❌ Failed to generate commit message: BATT_GROQ_API_KEY environment variable is not set. Please set it with: export BATT_GROQ_API_KEY=your_api_key
⚠️  You can write your commit message manually.
ℹ️  Run: git commit
```

**Cho Gemini:**
```
❌ Failed to generate commit message: BATT_GEMINI_API_KEY environment variable is not set. Please set it with: export BATT_GEMINI_API_KEY=your_api_key
⚠️  You can write your commit message manually.
ℹ️  Run: git commit
```

**Cho OpenAI:**
```
❌ Failed to generate commit message: BATT_OPENAI_API_KEY or OPENAI_API_KEY environment variable is not set. Please set it with: export BATT_OPENAI_API_KEY=your_api_key
⚠️  You can write your commit message manually.
ℹ️  Run: git commit
```

**Cho Claude:**
```
❌ Failed to generate commit message: BATT_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY environment variable is not set. Please set it with: export BATT_ANTHROPIC_API_KEY=your_api_key
⚠️  You can write your commit message manually.
ℹ️  Run: git commit
```

### Lỗi API

Nếu dịch vụ AI thất bại hoặc timeout:

```
⚠️  Failed to generate commit message: Request timeout: Groq API did not respond within 30 seconds.
ℹ️  You can write your commit message manually.
ℹ️  Run: git commit
```

Công cụ sẽ thoát một cách an toàn, cho phép bạn viết commit message thủ công.

## Cấu Trúc Dự Án

```
battery-generate-commit/
├── bin/
│   └── batt.js              # Điểm vào CLI
├── commands/
│   ├── genCommit.js         # Logic tạo commit chính
│   └── setup.js             # Thiết lập API key
├── services/
│   ├── git.service.js       # Các thao tác Git
│   ├── ai.service.js        # Tích hợp AI providers (Groq & Gemini)
│   └── config.service.js    # Trình tải cấu hình
├── prompts/
│   └── commit.prompt.txt    # Template prompt AI
├── utils/
│   └── logger.js            # Tiện ích logging
├── package.json
└── README.md
```

## Khắc Phục Sự Cố

### Không Tìm Thấy Lệnh

Nếu không tìm thấy lệnh `batt` sau khi chạy `npm link`:

1. Kiểm tra xem thư mục bin global của npm có trong PATH không:
   ```bash
   echo $PATH | grep npm
   ```

2. Tìm prefix global của npm:
   ```bash
   npm config get prefix
   ```

3. Thêm vào PATH nếu cần:
   ```bash
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```

### Không Tìm Thấy Git Repository

Đảm bảo bạn đang chạy lệnh trong một git repository:

```bash
cd /path/to/your/git/repo
batt -gen commit
```

### API Timeout

Nếu bạn thường xuyên gặp timeout:

1. Kiểm tra kết nối internet
2. Xác minh Groq API key của bạn có hợp lệ
3. Kiểm tra trạng thái Groq API: https://status.groq.com/

## Phát Triển

### Chạy Tests

```bash
npm test
```

### Publish Lên NPM

Để publish package lên npm registry:

1. **Đăng nhập npm:**
   ```bash
   npm login
   ```

2. **Bật Two-Factor Authentication (2FA):**
   - Truy cập: https://www.npmjs.com/settings/[your-username]/security
   - Bật 2FA (bắt buộc để publish package)

3. **Kiểm tra package name:**
   ```bash
   npm search battery-generate-commit
   ```
   Nếu package đã tồn tại, bạn cần đổi tên trong `package.json`

4. **Publish:**
   ```bash
   npm publish
   ```

5. **Sau khi publish, người dùng có thể cài đặt:**
   ```bash
   npm install -g battery-generate-commit
   ```

6. **Setup API key:**
   ```bash
   batt setup
   ```

**Lưu ý**: Nếu gặp lỗi 403, bạn cần:
- Bật 2FA trên npm account
- Hoặc tạo Granular Access Token với quyền "Publish" và "Bypass 2FA"

### Đóng Góp

1. Fork repository: [https://github.com/chithien-pin/battery-generate-commit](https://github.com/chithien-pin/battery-generate-commit)
2. Tạo feature branch
3. Thực hiện thay đổi
4. Gửi pull request

## Giấy Phép

MIT

## Hỗ Trợ

- **Repository**: [https://github.com/chithien-pin/battery-generate-commit](https://github.com/chithien-pin/battery-generate-commit)
- **Issues**: [https://github.com/chithien-pin/battery-generate-commit/issues](https://github.com/chithien-pin/battery-generate-commit/issues)

Đối với các vấn đề, câu hỏi hoặc đóng góp, vui lòng mở issue trên repository của dự án.

---

**Lưu ý**: Công cụ này yêu cầu API key từ một trong các nhà cung cấp: Groq, Google Gemini, OpenAI, hoặc Anthropic (tùy thuộc vào nhà cung cấp bạn chọn). Đảm bảo giữ API key của bạn an toàn và không bao giờ commit nó vào version control.
