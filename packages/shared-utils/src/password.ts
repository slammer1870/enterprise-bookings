import * as crypto from "crypto";

const defaultPasswordValidator = (password: string): string | true => {
  if (!password) return "No password was given";
  if (password.length < 3) return "Password must be at least 3 characters";

  return true;
};

function randomBytes(): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.randomBytes(32, (err, saltBuffer) =>
      err ? reject(err) : resolve(saltBuffer)
    )
  );
}

function pbkdf2Promisified(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.pbkdf2(password, salt, 25000, 512, "sha256", (err, hashRaw) =>
      err ? reject(err) : resolve(hashRaw)
    )
  );
}

type Args = {
  password: string;
};

export const generatePasswordSaltHash = async ({
  password,
}: Args): Promise<{ hash: string; salt: string }> => {
  const validationResult = defaultPasswordValidator(password);

  if (typeof validationResult === "string") {
    throw new Error("Invalid password");
  }

  const saltBuffer = await randomBytes();
  const salt = saltBuffer.toString("hex");

  const hashRaw = await pbkdf2Promisified(password, salt);
  const hash = hashRaw.toString("hex");

  return { hash, salt };
};

/**
 * Verify a password against a legacy Payload PBKDF2 hash.
 * Used for migrating users from Payload's built-in auth to Better Auth.
 *
 * @param password - The plaintext password to verify
 * @param salt - The hex-encoded salt from the users table
 * @param hash - The hex-encoded hash from the users table
 * @returns true if the password matches, false otherwise
 */
export const verifyLegacyPayloadPassword = async (
  password: string,
  salt: string,
  hash: string
): Promise<boolean> => {
  if (!password || !salt || !hash) {
    return false;
  }

  try {
    const computedHashRaw = await pbkdf2Promisified(password, salt);
    const computedHash = computedHashRaw.toString("hex");
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(hash, "hex")
    );
  } catch {
    return false;
  }
};
