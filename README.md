# Batt - Công Cụ Tạo Commit Message Bằng AI

Công cụ CLI Node.js sẵn sàng cho production, tạo commit message theo chuẩn Conventional Commits bằng AI. Batt phân tích các thay đổi git đã được stage và đề xuất commit message tuân theo đặc tả Conventional Commits.

## Tính Năng

- 🤖 **Hỗ trợ AI**: Hỗ trợ nhiều nhà cung cấp AI (Groq với Llama 3, Google Gemini) để tạo commit message thông minh
- 📝 **Conventional Commits**: Tự động định dạng message theo chuẩn Conventional Commits
- ⚙️ **Có thể cấu hình**: Cấu hình theo từng dự án qua file `.batt/config.json`, bao gồm chọn nhà cung cấp AI
- 🔒 **An toàn**: Luôn hỏi xác nhận trước khi commit
- 🚀 **Nhanh**: Thời gian phản hồi nhanh với các API hiện đại
- 🌍 **Đa nền tảng**: Hoạt động trên macOS, Linux và Windows

## Cài Đặt

### Yêu Cầu

- Node.js 18.0.0 trở lên
- Git đã được cài đặt và cấu hình
- Groq API key ([Lấy tại đây](https://console.groq.com/))

### Cài Đặt Dependencies

```bash
npm install
```

### Liên Kết CLI Tool

Để phát triển và test local:

```bash
npm link
```

Lệnh này sẽ làm cho lệnh `batt` có sẵn toàn cục trên hệ thống của bạn.

### Thiết Lập API Key

Batt hỗ trợ hai nhà cung cấp AI: **Groq** (mặc định) và **Gemini**. Bạn cần thiết lập API key cho nhà cung cấp bạn muốn sử dụng.

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

source ~/.zshrc
```

**Lưu ý**: Bạn chỉ cần thiết lập API key cho nhà cung cấp bạn muốn sử dụng. Xem phần [Cấu Hình](#cấu-hình) để chọn nhà cung cấp.

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
| `aiProvider` | string | `"groq"` | Nhà cung cấp AI để sử dụng (`groq` hoặc `gemini`) |
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
batt/
├── bin/
│   └── batt.js              # Điểm vào CLI
├── commands/
│   └── genCommit.js         # Logic tạo commit chính
├── services/
│   ├── git.service.js       # Các thao tác Git
│   ├── ai.service.js        # Tích hợp Groq API
│   └── config.service.js    # Trình tải cấu hình
├── prompts/
│   └── commit.prompt.txt    # Template prompt AI
├── utils/
│   └── logger.js            # Tiện ích logging
└── package.json
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

### Đóng Góp

1. Fork repository
2. Tạo feature branch
3. Thực hiện thay đổi
4. Gửi pull request

## Giấy Phép

MIT

## Hỗ Trợ

Đối với các vấn đề, câu hỏi hoặc đóng góp, vui lòng mở issue trên repository của dự án.

---

**Lưu ý**: Công cụ này yêu cầu API key từ Groq hoặc Google Gemini (tùy thuộc vào nhà cung cấp bạn chọn). Đảm bảo giữ API key của bạn an toàn và không bao giờ commit nó vào version control.
