import * as Crypto from 'expo-crypto';

/**
 * Hermes'te crypto.subtle yok; Supabase PKCE plain'e düşüp OAuth bozuluyor.
 * expo-crypto Expo Go'da da çalışır.
 */
type SubtleLike = {
  digest: (
    algorithm: AlgorithmIdentifier,
    data: BufferSource
  ) => Promise<ArrayBuffer>;
};

const root = globalThis as typeof globalThis & {
  crypto?: { getRandomValues?: Function; subtle?: SubtleLike };
};

if (!root.crypto) {
  root.crypto = {} as typeof root.crypto;
}

if (typeof root.crypto!.getRandomValues !== 'function') {
  root.crypto!.getRandomValues = <T extends ArrayBufferView>(array: T): T =>
    Crypto.getRandomValues(array);
}

if (!root.crypto!.subtle) {
  root.crypto!.subtle = {
    async digest(algorithm, data) {
      const name =
        typeof algorithm === 'string'
          ? algorithm
          : (algorithm as { name?: string }).name ?? '';
      if (name.toUpperCase() !== 'SHA-256') {
        throw new Error(`Unsupported digest algorithm: ${name}`);
      }
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(
              (data as ArrayBufferView).buffer,
              (data as ArrayBufferView).byteOffset,
              (data as ArrayBufferView).byteLength
            );
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
      // subtle.digest ArrayBuffer döndürmeli; TypedArray gelirse buffer'a çevir.
      if (digest instanceof ArrayBuffer) return digest;
      if (ArrayBuffer.isView(digest)) {
        const view = digest as ArrayBufferView;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
      }
      throw new Error('expo-crypto digest did not return ArrayBuffer');
    },
  };
}
