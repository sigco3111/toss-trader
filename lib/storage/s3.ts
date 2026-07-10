/**
 * lib/storage/s3.ts — toss-trader S3StorageProvider (v1.3)
 *
 * AWS S3 + Cloudflare R2 같은 S3 호환 API.
 * AWS SDK 의존성 없이 fetch + AWS SigV4 직접 구현 (의존성 최소화).
 *
 * 환경변수:
 * - S3_ENDPOINT: https://s3.ap-northeast-2.amazonaws.com (AWS) 또는
 *                https://<account>.r2.cloudflarestorage.com (R2)
 * - S3_BUCKET: toss-trader-history
 * - S3_ACCESS_KEY: AKIA...
 * - S3_SECRET_KEY: ...
 * - S3_REGION: ap-northeast-2 (기본값)
 * - S3_PREFIX: history/ (기본값, 버킷 내 경로)
 *
 * 인증: AWS SigV4 (HMAC-SHA256, node:crypto)
 */

import crypto from "node:crypto";
import type { HistoryRecord } from "../types";
import type {
  StorageProvider,
  AvailabilityResult,
  SaveResult,
  ListResult,
  ListOptions,
} from "./provider";

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function isConfigured(): boolean {
  return !!(getEnv("S3_ENDPOINT") && getEnv("S3_BUCKET") && getEnv("S3_ACCESS_KEY") && getEnv("S3_SECRET_KEY"));
}

// ─── AWS SigV4 ──────────────────────────────────────────────
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256("AWS4" + secretKey, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  return kSigning;
}

function signRequest(
  method: string,
  url: URL,
  body: string,
  headers: Record<string, string>
): Record<string, string> {
  const accessKey = getEnv("S3_ACCESS_KEY")!;
  const secretKey = getEnv("S3_SECRET_KEY")!;
  const region = getEnv("S3_REGION") ?? "us-east-1";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const path = url.pathname === "" ? "/" : url.pathname;

  // Canonical request
  const payloadHash = sha256(body);
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k].trim()}\n`)
    .join("");
  const signedHeaders = Object.keys(headers).sort().join(";");

  const canonicalRequest = [
    method,
    path,
    url.search.slice(1) || "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: authorization,
  };
}

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3" as const;

  private getUrl(filename: string): URL {
    const endpoint = getEnv("S3_ENDPOINT")!.replace(/\/$/, "");
    const bucket = getEnv("S3_BUCKET")!;
    const prefix = getEnv("S3_PREFIX") ?? "history";
    return new URL(`${endpoint}/${bucket}/${prefix}/${filename}`);
  }

  async checkAvailability(): Promise<AvailabilityResult> {
    if (!isConfigured()) {
      return {
        availability: "disabled",
        message:
          "S3 미설정. S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY 환경변수 필요.",
      };
    }

    // 버킷 헤드 체크 (간단 가용성)
    try {
      const url = this.getUrl(".write-test");
      const headers = { host: url.host, "x-amz-content-sha256": sha256("") };
      const signed = signRequest("HEAD", url, "", headers);
      const res = await fetch(url.toString(), { method: "HEAD", headers: signed });
      if (res.status === 200 || res.status === 204) {
        return { availability: "available" };
      }
      if (res.status === 403) {
        return {
          availability: "readonly",
          message: `S3 권한 부족 (403). S3_ACCESS_KEY 권한 확인.`,
        };
      }
      if (res.status === 404) {
        return {
          availability: "disabled",
          message: `S3 버킷 없음 (404). S3_BUCKET 확인.`,
        };
      }
      return {
        availability: "disabled",
        message: `S3 응답 ${res.status}: ${res.statusText}`,
      };
    } catch (e) {
      return {
        availability: "disabled",
        message: `S3 연결 실패: ${(e as Error).message}`,
      };
    }
  }

  async save(record: HistoryRecord): Promise<SaveResult> {
    const availability = (await this.checkAvailability()).availability;
    if (availability !== "available") {
      return { saved: false, filename: "", availability };
    }

    const base = `${record.epochSeconds}.json`;
    let filename = base;
    let counter = 2;
    while (true) {
      const url = this.getUrl(filename);
      const body = `${JSON.stringify(record, null, 2)}\n`;
      const headers = {
        host: url.host,
        "content-type": "application/json",
      };
      const signed = signRequest("PUT", url, body, headers);
      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: signed,
        body,
      });
      if (res.ok) {
        return { saved: true, filename, availability: "available" };
      }
      if (res.status === 409 || res.status === 412) {
        // 이미 존재 (PUT overwrites normally, but conflict possible with versioning)
        filename = `${record.epochSeconds}-${counter}.json`;
        counter += 1;
        continue;
      }
      // 기타 에러
      return {
        saved: false,
        filename: "",
        availability: "readonly",
        message: `S3 PUT 실패: ${res.status} ${res.statusText}`,
      };
    }
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const availability = (await this.checkAvailability()).availability;
    if (availability !== "available") {
      return { records: [], count: 0, availability };
    }
    const limit = options.limit ?? 100;
    const prefix = getEnv("S3_PREFIX") ?? "history";
    const endpoint = getEnv("S3_ENDPOINT")!.replace(/\/$/, "");
    const bucket = getEnv("S3_BUCKET")!;

    // ListObjectsV2 query
    const url = new URL(`${endpoint}/${bucket}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix + "/");
    url.searchParams.set("max-keys", String(Math.max(limit, 1000)));

    const headers = { host: url.host };
    const signed = signRequest("GET", url, "", headers);
    const res = await fetch(url.toString(), { method: "GET", headers: signed });
    if (!res.ok) {
      return {
        records: [],
        count: 0,
        availability: "readonly",
        message: `S3 List 실패: ${res.status}`,
      };
    }
    const text = await res.text();
    // XML 파싱 (간단 정규식)
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    const keys: string[] = [];
    let match;
    while ((match = keyRegex.exec(text)) !== null) {
      keys.push(match[1]);
    }

    // 각 객체 fetch
    const records = await Promise.all(
      keys.map(async (key) => {
        const filename = key.replace(`${prefix}/`, "");
        const objUrl = this.getUrl(filename);
        const objHeaders = { host: objUrl.host };
        const objSigned = signRequest("GET", objUrl, "", objHeaders);
        const objRes = await fetch(objUrl.toString(), {
          method: "GET",
          headers: objSigned,
        });
        const body = await objRes.text();
        return { file: filename, record: JSON.parse(body) as HistoryRecord };
      })
    );

    let filtered = records;
    if (options.kind) {
      filtered = filtered.filter((r) => r.record.kind === options.kind);
    }
    if (options.symbol) {
      filtered = filtered.filter((r) => {
        const rec = r.record;
        if (rec.kind === "analysis") return rec.symbol === options.symbol;
        if (rec.kind === "order") return rec.request.symbol === options.symbol;
        return false;
      });
    }

    return {
      records: filtered.slice(-limit),
      count: filtered.length,
      availability: "available",
    };
  }
}
