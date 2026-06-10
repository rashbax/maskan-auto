// Verifies R2: creds, presigned PUT, and public read. Run:
// node --env-file=.env.local scripts/check-r2.mjs
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC = process.env.R2_PUBLIC_URL;
const AK = process.env.R2_ACCESS_KEY_ID;
const SK = process.env.R2_SECRET_ACCESS_KEY;

const show = { R2_ACCOUNT_ID: ACCOUNT, R2_BUCKET: BUCKET, R2_PUBLIC_URL: PUBLIC, R2_ACCESS_KEY_ID: AK, R2_SECRET_ACCESS_KEY: SK };
for (const [k, v] of Object.entries(show)) {
  const masked = k.includes("SECRET") || k.includes("ACCESS_KEY_ID") ? (v ? `(${String(v).length} chars)` : "") : v;
  console.log((v ? "✅" : "❌"), k, "=", v ? masked : "YO'Q");
}
if (!ACCOUNT || !BUCKET || !PUBLIC || !AK || !SK) { console.error("\n❌ Ba'zi R2 env yo'q"); process.exit(1); }

const s3 = new S3Client({ region: "auto", endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`, credentials: { accessKeyId: AK, secretAccessKey: SK } });
const key = `test/hello-${Date.now()}.txt`;

console.log("\n--- presigned PUT ---");
const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: "text/plain" }), { expiresIn: 300 });
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "maskan r2 test" });
console.log(put.ok ? "✅ presigned PUT ishladi" : "❌ PUT xato: HTTP " + put.status);

console.log("\n--- public URL o'qish ---");
const publicUrl = `${PUBLIC.replace(/\/$/, "")}/${key}`;
const get = await fetch(publicUrl);
console.log(get.ok ? `✅ public URL ochildi: "${(await get.text()).slice(0, 40)}"` : "❌ public URL xato: HTTP " + get.status + " (Public dev URL yoqilganmi?)");

await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
console.log("\n🧹 test obyekt o'chirildi");
