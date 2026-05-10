import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

/**
 * AES key material from XERO_ENCRYPTION_KEY (required — never commit keys).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.XERO_ENCRYPTION_KEY
  if (!key || key.trim().length === 0) {
    throw new Error(
      'XERO_ENCRYPTION_KEY must be set (min 32 characters). Generate one for local dev in .env.local.'
    )
  }

  if (key.length < 32) {
    throw new Error('XERO_ENCRYPTION_KEY must be at least 32 characters long')
  }
  
  // Use first 32 characters as key
  return Buffer.from(key.substring(0, 32), 'utf8')
}

/**
 * Encrypt token set using AES-256-GCM
 */
export function encryptTokenSet(tokenSet: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(tokenSet, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Combine iv, tag, and encrypted data
  const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
  
  return combined
}

/**
 * Decrypt token set using AES-256-GCM
 */
export function decryptTokenSet(encryptedTokenSet: string): string {
  const key = getEncryptionKey()
  const parts = encryptedTokenSet.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token set format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

