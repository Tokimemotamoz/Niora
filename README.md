
# Niora — Deploy-ready MVP (Georgian UI)

ეს არის **არალოკალური საიტის** მოსამზადებელი ვერსია:
- frontend: სტატიკური საიტი
- backend: Supabase
- deploy: Vercel ან Netlify

## რა შეუძლია
- Georgian UI
- dark mode
- email/password რეგისტრაცია და შესვლა
- პირველი პროფილი ხდება admin
- admin შეუძლია სხვა user-ის role შეცვალოს (admin / manager / worker)
- admin ქმნის მაღაზიებს
- საერთო კატალოგი
- ძებნა სახელით ან ბოლო 5 ციფრით
- ვადის დამატება
- სწრაფი ღილაკები: +1 / +5 / +10 დღე
- ვადაგასულში გადატანა
- ხელით დამატება ვადაგასულში ძიებით
- თვიური რეპორტი

## როგორ გახდეს რეალური ონლაინ საიტი
1. შექმენი Supabase project
2. SQL Editor-ში ჩასვი `supabase_schema.sql`
3. Project Settings → API-დან აიღე:
   - URL
   - anon public key
4. `public/config.js`-ში ჩასვი ეს ორი მნიშვნელობა
5. GitHub-ზე ატვირთე ეს ფოლდერი
6. Vercel-ზე Import Project → Deploy

## Email confirmation / კოდი Gmail-ზე
Supabase-ს შეუძლია email confirmation და OTP.
თუ გინდა **ბმულის ნაცვლად კოდი**, Auth → Email Templates-ში გამოიყენე `{{ .Token }}`.
თუ Confirm Email ჩართულია, signup-ის შემდეგ session არ იქმნება სანამ user არ დაადასტურებს email-ს.

## შენიშვნა
ეს MVP გამიზნულია სწრაფი ტესტისთვის. Production-ზე აუცილებელია:
- უფრო მკაცრი RLS policies
- custom SMTP
- cron / scheduled function email-ებისთვის
