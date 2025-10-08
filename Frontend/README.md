# نظام المالية - RAJAC Language Schools

## نظرة عامة
نظام إدارة مالية شامل لمدارس RAJAC يسمح بإدارة رسوم الطلاب والمعاملات المالية والأرصدة.

## الميزات
- 🎓 **إدارة الرسوم**: البحث عن الطلاب وتسجيل المدفوعات
- 💰 **المعاملات المالية**: تتبع الإيرادات والمصروفات
- 📊 **لوحة الأرصدة**: عرض النقد في الصندوق والبنك
- 🌙 **الوضع المظلم**: دعم كامل للوضع الليلي
- 🌐 **دعم العربية**: واجهة باللغة العربية مع دعم RTL

## ربط Google Apps Script

1. انسخ كود Google Apps Script المرفق
2. أنشئ مشروع جديد في [Google Apps Script](https://script.google.com)
3. الصق الكود واحفظ المشروع
4. انشر المشروع كـ "Web App" مع الإعدادات:
   - **Execute as**: Me
   - **Who has access**: Anyone
5. انسخ رابط الـ API واستبدله في `src/lib/api.ts`

## كيفية تحرير الكود؟

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e9d5a5b0-2104-4c97-b815-4b63a9a8d776) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e9d5a5b0-2104-4c97-b815-4b63a9a8d776) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
