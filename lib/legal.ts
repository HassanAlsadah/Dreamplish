import type { Locale } from "@/lib/i18n/config";

/**
 * Privacy Policy and Terms of Use. Every statement here describes what the code actually does; when
 * the code changes what is collected, sent or kept, update this file (and LEGAL.updated).
 */
export const LEGAL = {
  operator: "Hassan",
  contactEmail: "dreamplish.support@gmail.com",
  updated: "2026-10-19",
} as const;

export type LegalSection = { title: string; body: Array<string | string[]> };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

const email = LEGAL.contactEmail;

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  intro: `Dreamplish helps you track job applications, check your fit for a job, tailor your CV and prepare for interviews. It is run by ${LEGAL.operator} (“we”). This policy explains what we collect, why, who processes it, and the rights you have under Saudi Arabia’s Personal Data Protection Law (PDPL).`,
  sections: [
    {
      title: "What we collect",
      body: [
        [
          "Account: you sign in with Google, which gives us your name, email address and profile picture link. We never see your Google password.",
          "What you add: jobs, companies, links, notes, job descriptions, board columns, application history and steps, and how you applied.",
          "Your CV: the text you paste or upload, and the original file if you upload one.",
          "Results we generate for you: match reports, skill checks, tailored CVs and interview preparation.",
          "Connected mailboxes (only if you connect one): the mailbox address, an encrypted access token and sync progress. From job-related emails we keep only what we extract: the sender’s name, subject, a link to open the email, the company, role, interview or assessment type, a job link and description if the email contains one, and how you applied. We never store whole emails.",
          "Usage counts: when you use AI tools, email sync and searches, so daily limits can be applied.",
          "Your language choice, and technical data our hosting provider logs to run the service (such as IP address and request time).",
        ],
      ],
    },
    {
      title: "How we use it",
      body: [
        "Only to provide Dreamplish to you: showing your board, matching your CV to jobs, tailoring CVs, preparing interviews, researching companies you apply to, and turning job emails into suggestions you review. We do not sell your data, show ads, or use it for marketing.",
      ],
    },
    {
      title: "AI and research",
      body: [
        "Some features send information to Google’s Gemini AI: job descriptions, your CV text with your name, email addresses, phone numbers and links removed first, and for connected mailboxes the subject, sender and the first part of job-related emails, with personal details removed.",
        "Dreamplish uses Gemini’s free tier. Under Google’s terms, Google may use what is sent to the free tier, and the responses, to improve its products, and people at Google may review it. Please don’t add information to job notes or descriptions that you don’t want processed this way.",
        "Company briefings search the web (with Tavily or Google Search) for the company name and the roles you track there. Briefings contain only public information about companies and are shared between users who track the same company.",
        "To read a job posting from a link, our server opens that page.",
      ],
    },
    {
      title: "Who processes your data",
      body: [
        [
          "Supabase: database, sign-in and file storage. Your data is stored in Tokyo, Japan.",
          "Vercel: hosts the app, with servers in Tokyo, Japan.",
          "Google: sign-in, and Gemini AI.",
          "Microsoft: Outlook, if you connect it.",
          "Tavily: web search for company briefings and job descriptions.",
        ],
        "Because these providers are outside Saudi Arabia, your data is transferred abroad to provide the service, as the PDPL permits for this purpose.",
      ],
    },
    {
      title: "Connected mailboxes",
      body: [
        "Access is read-only: Dreamplish can never send, change or delete your emails. It looks for job-related messages (applications, assessments, interviews, offers, rejections) and suggests updates you accept or ignore. You can disconnect at any time from your profile; your token and pending suggestions are deleted, and you can also revoke access in your Microsoft account settings.",
      ],
    },
    {
      title: "Cookies and storage",
      body: [
        [
          "A sign-in cookie that keeps you signed in.",
          "A cookie that remembers your language.",
          "A short-lived cookie (10 minutes) used only while you connect a mailbox.",
          "Your browser’s storage remembers your theme and which board columns you collapsed.",
        ],
        "We use no analytics, advertising or tracking cookies.",
      ],
    },
    {
      title: "How long we keep it",
      body: [
        "We keep your data while your account exists. Deleting your account (Profile → Delete account) immediately deletes your profile, jobs, CV and its file, history, results, mailbox connections and usage counts. Company briefings contain no personal data and remain. Our hosting provider keeps technical logs for a limited period.",
      ],
    },
    {
      title: "Your rights",
      body: [
        `Under the PDPL you can ask to access your data, get a copy, correct it, have it deleted, and withdraw consent (for example by disconnecting a mailbox or deleting your account). You can edit and delete most data in the app yourself; for a copy of your data or anything else, email ${email}. We reply within 30 days. You can also complain to the Saudi Data & AI Authority (SDAIA).`,
      ],
    },
    {
      title: "Security",
      body: [
        "Data is encrypted in transit. Each account can only reach its own data, enforced by the database itself. Mailbox tokens are encrypted, and CV details are removed before CV text goes to the AI. No system is perfectly secure; if a breach affects your data, we will tell you and the authorities as the law requires.",
      ],
    },
    {
      title: "Children",
      body: ["Dreamplish is for people aged 18 and over. We do not knowingly collect data from children."],
    },
    {
      title: "Changes and contact",
      body: [`We will update this page when our practices change and show the date below. Questions or requests: ${email}.`],
    },
  ],
};

const privacyAr: LegalDoc = {
  title: "سياسة الخصوصية",
  intro: `يساعدك دريمبلش على متابعة طلبات التوظيف، والتحقق من مدى توافقك مع الوظيفة، وتخصيص سيرتك الذاتية، والاستعداد للمقابلات. يديره ${LEGAL.operator} («نحن»). توضح هذه السياسة البيانات التي نجمعها، وسبب جمعها، والجهات التي تعالجها، وحقوقك بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية.`,
  sections: [
    {
      title: "البيانات التي نجمعها",
      body: [
        [
          "الحساب: تسجّل الدخول بحساب Google، فنحصل على اسمك وبريدك الإلكتروني ورابط صورتك الشخصية. ولا نطّلع أبدًا على كلمة مرور Google.",
          "ما تضيفه: الوظائف والشركات والروابط والملاحظات والأوصاف الوظيفية وأعمدة اللوحة وسجل الطلبات وخطواتها وطريقة التقديم.",
          "سيرتك الذاتية: النص الذي تلصقه أو ترفعه، والملف الأصلي إذا رفعته.",
          "النتائج التي ننشئها لك: تقارير المطابقة وفحص المهارات والسير الذاتية المخصّصة والتحضير للمقابلات.",
          "صناديق البريد المرتبطة (فقط إذا ربطت واحدًا): عنوان البريد ورمز وصول مشفّر وحالة المزامنة. ومن رسائل التوظيف نحتفظ فقط بما نستخرجه: اسم المرسل والعنوان ورابط فتح الرسالة والشركة والمسمى ونوع المقابلة أو التقييم ورابط الوظيفة ووصفها إن وُجدا في الرسالة وطريقة التقديم. لا نحفظ الرسائل كاملة أبدًا.",
          "أعداد الاستخدام: عند استخدام أدوات الذكاء الاصطناعي ومزامنة البريد والبحث، لتطبيق الحدود اليومية.",
          "اللغة التي تختارها، وبيانات تقنية يسجّلها مزوّد الاستضافة لتشغيل الخدمة (مثل عنوان IP ووقت الطلب).",
        ],
      ],
    },
    {
      title: "كيف نستخدمها",
      body: [
        "فقط لتقديم دريمبلش لك: عرض لوحتك، ومطابقة سيرتك مع الوظائف، وتخصيص السير الذاتية، والتحضير للمقابلات، والبحث عن الشركات التي تتقدّم إليها، وتحويل رسائل التوظيف إلى اقتراحات تراجعها بنفسك. لا نبيع بياناتك، ولا نعرض إعلانات، ولا نستخدمها للتسويق.",
      ],
    },
    {
      title: "الذكاء الاصطناعي والبحث",
      body: [
        "ترسل بعض الميزات معلومات إلى Gemini من Google: الأوصاف الوظيفية، ونص سيرتك بعد إزالة اسمك وعناوين بريدك وأرقام هاتفك وروابطك، ولصناديق البريد المرتبطة عنوان رسائل التوظيف ومرسلها والجزء الأول منها بعد إزالة البيانات الشخصية.",
        "يستخدم دريمبلش الفئة المجانية من Gemini. وبموجب شروط Google، يجوز لـGoogle استخدام ما يُرسل إلى الفئة المجانية وإجاباته لتحسين منتجاتها، وقد يطّلع عليه موظفون لديها. نرجو ألا تضيف إلى ملاحظات الوظائف أو أوصافها معلومات لا ترغب في معالجتها بهذه الطريقة.",
        "تبحث ملخصات الشركات في الإنترنت (عبر Tavily أو بحث Google) عن اسم الشركة والمسميات التي تتابعها فيها. لا تحتوي الملخصات إلا على معلومات عامة عن الشركات، وتُشارك بين المستخدمين الذين يتابعون الشركة نفسها.",
        "لقراءة إعلان وظيفة من رابط، يفتح خادمنا تلك الصفحة.",
      ],
    },
    {
      title: "الجهات التي تعالج بياناتك",
      body: [
        [
          "Supabase: قاعدة البيانات وتسجيل الدخول وتخزين الملفات. تُخزَّن بياناتك في طوكيو، اليابان.",
          "Vercel: يستضيف التطبيق، على خوادم في طوكيو، اليابان.",
          "Google: تسجيل الدخول، والذكاء الاصطناعي Gemini.",
          "Microsoft: بريد Outlook إذا ربطته.",
          "Tavily: البحث في الإنترنت لملخصات الشركات والأوصاف الوظيفية.",
        ],
        "ولأن هذه الجهات خارج المملكة العربية السعودية، تُنقل بياناتك إلى الخارج لتقديم الخدمة، وفق ما يجيزه النظام لهذا الغرض.",
      ],
    },
    {
      title: "صناديق البريد المرتبطة",
      body: [
        "الوصول للقراءة فقط: لا يستطيع دريمبلش إرسال رسائلك أو تعديلها أو حذفها. يبحث عن رسائل التوظيف (التقديم والتقييمات والمقابلات والعروض والرفض) ويقترح تحديثات تقبلها أو تتجاهلها. يمكنك فصل البريد في أي وقت من ملفك، فيُحذف رمز الوصول والاقتراحات المعلّقة، ويمكنك أيضًا إلغاء الوصول من إعدادات حسابك في Microsoft.",
      ],
    },
    {
      title: "ملفات تعريف الارتباط والتخزين",
      body: [
        [
          "ملف تعريف ارتباط يُبقيك مسجّلًا للدخول.",
          "ملف تعريف ارتباط يتذكّر لغتك.",
          "ملف تعريف ارتباط قصير (10 دقائق) يُستخدم فقط أثناء ربط صندوق بريد.",
          "يتذكّر متصفحك المظهر الذي اخترته والأعمدة التي طويتها في اللوحة.",
        ],
        "لا نستخدم ملفات تعريف ارتباط للتحليلات أو الإعلانات أو التتبّع.",
      ],
    },
    {
      title: "مدة الاحتفاظ",
      body: [
        "نحتفظ ببياناتك ما دام حسابك قائمًا. حذف الحساب (الملف ← حذف الحساب) يحذف فورًا ملفك ووظائفك وسيرتك وملفها والسجل والنتائج وروابط البريد وأعداد الاستخدام. لا تحتوي ملخصات الشركات على بيانات شخصية وتبقى. يحتفظ مزوّد الاستضافة بالسجلات التقنية لمدة محدودة.",
      ],
    },
    {
      title: "حقوقك",
      body: [
        `بموجب النظام يحق لك طلب الوصول إلى بياناتك والحصول على نسخة منها وتصحيحها وحذفها والرجوع عن موافقتك (مثلًا بفصل صندوق البريد أو حذف حسابك). يمكنك تعديل معظم البيانات وحذفها بنفسك في التطبيق، ولطلب نسخة من بياناتك أو أي طلب آخر راسلنا على ${email}، ونرد خلال 30 يومًا. ويحق لك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).`,
      ],
    },
    {
      title: "الأمان",
      body: [
        "تُشفَّر البيانات أثناء نقلها. ولا يصل كل حساب إلا إلى بياناته، وتفرض قاعدة البيانات ذلك بنفسها. تُشفَّر رموز الوصول إلى البريد، وتُزال البيانات الشخصية من نص السيرة قبل إرساله إلى الذكاء الاصطناعي. لا يوجد نظام آمن تمامًا، وإن تأثرت بياناتك باختراق فسنبلغك ونبلغ الجهات المختصة وفق ما يقتضيه النظام.",
      ],
    },
    {
      title: "الأطفال",
      body: ["دريمبلش مخصّص لمن بلغوا 18 عامًا فأكثر، ولا نجمع عن قصد بيانات الأطفال."],
    },
    {
      title: "التغييرات والتواصل",
      body: [`سنحدّث هذه الصفحة عند تغيّر ممارساتنا ونوضح تاريخ التحديث أدناه. للأسئلة والطلبات: ${email}.`],
    },
  ],
};

const termsEn: LegalDoc = {
  title: "Terms of Use",
  intro: `These terms apply when you use Dreamplish, run by ${LEGAL.operator}. By creating an account or using the service you agree to them and to the Privacy Policy.`,
  sections: [
    { title: "Who can use it", body: ["You must be 18 or older and sign in with your own Google account. Keep that account secure; you are responsible for what happens in your Dreamplish account."] },
    {
      title: "Acceptable use",
      body: [
        [
          "Use Dreamplish for your own job search.",
          "Don’t add other people’s personal data without a lawful reason, or content that is illegal or infringes others’ rights.",
          "Don’t try to break, overload, scrape or get around the limits or security of the service, or access other accounts.",
        ],
      ],
    },
    { title: "Your content", body: ["What you add stays yours. You allow us to store and process it only to provide the service to you, as described in the Privacy Policy. Delete it, or your account, at any time."] },
    {
      title: "AI results and briefings",
      body: [
        "Match scores, tailored CVs, interview preparation and company briefings are generated by AI from your data and public sources. They can be incomplete or wrong. Review everything before you send it to an employer or rely on it; tailored CVs only rephrase facts from your own CV, and you are responsible for what you submit. Nothing in Dreamplish is professional, legal or career advice.",
      ],
    },
    { title: "Other services", body: ["Signing in with Google, and connecting Outlook, are also governed by Google’s and Microsoft’s terms. We are not responsible for their services."] },
    { title: "A free service", body: ["Dreamplish is free. Features have daily limits, and we may change, limit or stop any part of the service, with notice where we reasonably can."] },
    {
      title: "No warranty, and limits of liability",
      body: [
        "The service is provided “as is”, without guarantees that it will be uninterrupted, error-free or that it will help you get a job. To the extent Saudi law allows, we are not liable for indirect losses, or for decisions you make based on the service.",
      ],
    },
    { title: "Ending your use", body: ["You can delete your account at any time. We may suspend or close accounts that break these terms or put the service or other users at risk."] },
    { title: "Law", body: ["These terms are governed by the laws of the Kingdom of Saudi Arabia, and disputes fall under the jurisdiction of its competent courts."] },
    { title: "Changes and contact", body: [`We will post changes here with a new date; continuing to use Dreamplish means you accept them. Questions: ${email}.`] },
  ],
};

const termsAr: LegalDoc = {
  title: "شروط الاستخدام",
  intro: `تسري هذه الشروط عند استخدامك دريمبلش الذي يديره ${LEGAL.operator}. بإنشاء حساب أو استخدام الخدمة فإنك توافق عليها وعلى سياسة الخصوصية.`,
  sections: [
    { title: "من يحق له الاستخدام", body: ["يجب أن يكون عمرك 18 عامًا فأكثر، وأن تسجّل الدخول بحساب Google خاص بك. حافظ على أمان ذلك الحساب، فأنت مسؤول عمّا يحدث في حسابك على دريمبلش."] },
    {
      title: "الاستخدام المقبول",
      body: [
        [
          "استخدم دريمبلش لبحثك الخاص عن عمل.",
          "لا تضف بيانات شخصية لغيرك دون مسوّغ نظامي، ولا محتوى مخالفًا للأنظمة أو منتهكًا لحقوق الآخرين.",
          "لا تحاول تعطيل الخدمة أو إغراقها بالطلبات أو استخراج بياناتها آليًا أو تجاوز حدودها أو حمايتها، أو الوصول إلى حسابات الآخرين.",
        ],
      ],
    },
    { title: "محتواك", body: ["ما تضيفه يبقى ملكك. وتأذن لنا بتخزينه ومعالجته فقط لتقديم الخدمة لك، كما توضح سياسة الخصوصية. يمكنك حذفه أو حذف حسابك في أي وقت."] },
    {
      title: "نتائج الذكاء الاصطناعي والملخصات",
      body: [
        "تُنشأ درجات المطابقة والسير المخصّصة والتحضير للمقابلات وملخصات الشركات بالذكاء الاصطناعي من بياناتك ومن مصادر عامة، وقد تكون ناقصة أو غير صحيحة. راجع كل شيء قبل إرساله إلى صاحب العمل أو الاعتماد عليه؛ فالسيرة المخصّصة تعيد صياغة ما في سيرتك فقط، وأنت مسؤول عمّا تقدّمه. لا يُعدّ أي شيء في دريمبلش استشارة مهنية أو قانونية أو وظيفية.",
      ],
    },
    { title: "الخدمات الأخرى", body: ["يخضع تسجيل الدخول بـGoogle وربط Outlook أيضًا لشروط Google وMicrosoft، ولسنا مسؤولين عن خدماتهما."] },
    { title: "خدمة مجانية", body: ["دريمبلش مجاني. للميزات حدود يومية، ويجوز لنا تغيير أي جزء من الخدمة أو تقييده أو إيقافه، مع الإشعار متى أمكن ذلك بشكل معقول."] },
    {
      title: "إخلاء المسؤولية وحدودها",
      body: [
        "تُقدَّم الخدمة «كما هي» دون ضمان استمرارها دون انقطاع أو خلوّها من الأخطاء أو أنها ستساعدك في الحصول على وظيفة. وفي الحدود التي تسمح بها الأنظمة السعودية، لا نتحمّل المسؤولية عن الخسائر غير المباشرة أو عن القرارات التي تتخذها بناءً على الخدمة.",
      ],
    },
    { title: "إنهاء الاستخدام", body: ["يمكنك حذف حسابك في أي وقت. ويجوز لنا إيقاف الحسابات التي تخالف هذه الشروط أو تعرّض الخدمة أو المستخدمين الآخرين للخطر، أو إغلاقها."] },
    { title: "النظام الواجب التطبيق", body: ["تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص محاكمها المختصة بالنظر في أي نزاع."] },
    { title: "التغييرات والتواصل", body: [`سننشر أي تغييرات هنا مع تاريخ جديد، واستمرارك في استخدام دريمبلش يعني قبولك لها. للأسئلة: ${email}.`] },
  ],
};

export const LEGAL_DOCS: Record<"privacy" | "terms", Record<Locale, LegalDoc>> = {
  privacy: { en: privacyEn, ar: privacyAr },
  terms: { en: termsEn, ar: termsAr },
};
