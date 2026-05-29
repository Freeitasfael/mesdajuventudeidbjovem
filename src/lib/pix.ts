// Gerador de payload Pix "Copia e Cola" (BR Code / EMV)

function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max);
}

export interface PixPayloadParams {
  key: string;
  amount: number;
  merchantName: string;
  merchantCity: string;
  txid?: string;
}

export function generatePixPayload({
  key,
  amount,
  merchantName,
  merchantCity,
  txid = "***",
}: PixPayloadParams): string {
  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", key);
  const additional = field("05", txid);

  const payloadNoCRC =
    field("00", "01") +
    field("26", merchantAccount) +
    field("52", "0000") +
    field("53", "986") +
    field("54", amount.toFixed(2)) +
    field("58", "BR") +
    field("59", normalize(merchantName, 25)) +
    field("60", normalize(merchantCity, 15)) +
    field("62", additional) +
    "6304";

  return payloadNoCRC + crc16(payloadNoCRC);
}
