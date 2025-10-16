import { decode } from "iconv-lite";
import { decode as decodeQuotedPrintable } from "quoted-printable";
import {Buffer} from "buffer";

export function decodeMessage(data) {
    const raw = typeof data === "string" ? data : JSON.stringify(data);

    const htmlMatch = raw.match(/<html[\s\S]*<\/html>/i);
    if (!htmlMatch) {
        console.log("[MailTm] ❌ HTML body not found");
        return null;
    }

    const htmlRaw = htmlMatch[0];

    const htmlDecoded = decodeQuotedPrintable(htmlRaw);

    const htmlText = decode(Buffer.from(htmlDecoded, "binary"), "utf-8");
    const contentMatch = htmlText.match(/<td class=["']content["'][^>]*>([\s\S]*?)<\/td>/i);
    if (!contentMatch) {
        console.log("[MailTm] ⚠️ Content block not found");
        return null;
    }

    const contentBlock = contentMatch[1].trim();

    const codeMatch = contentBlock.match(/\b\d{6}\b/);
    const code = codeMatch ? codeMatch[0] : null;

    return {
        html: `<td class="content">${contentBlock}</td>`,
        code,
    };
}