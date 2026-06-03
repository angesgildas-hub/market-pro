import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const currentDirname = typeof __dirname !== "undefined"
  ? __dirname
  : (() => {
      try {
        return path.dirname(fileURLToPath(import.meta.url));
      } catch (e) {
        return "";
      }
    })();

async function startServer() {
  const app = express();

  // Determine if running in production mode
  let isProduction = process.env.NODE_ENV === "production";

  // Robust check: if this code is running from the compiled server.cjs bundle, it is 100% production
  const isCjsBundle = typeof __filename !== "undefined" && (__filename.includes("dist") || __filename.endsWith(".cjs"));
  if (isCjsBundle) {
    isProduction = true;
  }

  // Always bind unconditionally to port 3000 per platform infrastructure constraints
  const PORT = 3000;

  // Body parser
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Email sending endpoint
  app.post("/api/send-email", async (req, res) => {
    const { type, data } = req.body;

    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    const smtpFrom = process.env.SMTP_FROM || `"Market Pro" <noreply@marketpro.com>`;
    const appUrl = process.env.APP_URL || "https://marketpro.com";

    console.log(`[Email Service] Received request to send email of type "${type}"`);

    // Let's build the email parameters
    let to = "";
    let subject = "";
    let html = "";
    let text = "";

    if (type === "store_requested") {
      to = "anges.gildas@gmail.com";
      subject = `[Market Pro] Nouvelle demande de création de boutique : ${data.storeName}`;
      text = `Bonjour Admin,

Un utilisateur vient de soumettre une demande de création de boutique.

Voici les détails de la demande :
- Nom de la boutique : ${data.storeName}
- Administrateur : ${data.displayName} (${data.email})
- Adresse : ${data.address || 'Non spécifiée'}
- Pays : ${data.country || 'Non spécifié'}

Rendez-vous sur l'espace Super Admin de Market Pro pour examiner et approuver cette demande.

Cordialement,
Le système Market Pro.`;

      html = `<div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #ea580c; border-bottom: 2px solid #f97316; padding-bottom: 8px;">Nouvelle Demande de Boutique</h2>
        <p>Bonjour Admin,</p>
        <p>Un utilisateur vient de s'inscrire et de soumettre une demande de création de boutique sur Market Pro.</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Nom de la boutique :</strong> ${data.storeName}</p>
          <p style="margin: 5px 0;"><strong>Administrateur :</strong> ${data.displayName}</p>
          <p style="margin: 5px 0;"><strong>Email :</strong> <a href="mailto:${data.email}">${data.email}</a></p>
          <p style="margin: 5px 0;"><strong>Adresse :</strong> ${data.address || 'Non spécifiée'}</p>
          <p style="margin: 5px 0;"><strong>Pays :</strong> ${data.country || 'Non spécifié'}</p>
        </div>
        <p>Veuillez vous rendre sur l'espace Super Admin de Market Pro pour attribuer ou valider la licence.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #6b7280;">Ceci est un message automatique, merci de ne pas y répondre.</p>
      </div>`;

    } else if (type === "store_approved") {
      to = data.email;
      subject = `[Market Pro] Votre boutique "${data.storeName}" a été approuvée ! 🎉`;
      text = `Félicitations ${data.displayName},

Votre demande pour la boutique "${data.storeName}" a été approuvée par l'administrateur principal. 
Vous pouvez à présent vous connecter et commencer à gérer votre boutique.

Lien de connexion : ${appUrl}

Nous vous remercions pour votre confiance.

Cordialement,
L'équipe Market Pro (No-Reply)`;

      html = `<div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #16a34a; border-bottom: 2px solid #22c55e; padding-bottom: 8px;">Félicitations ! 🎉</h2>
        <p>Bonjour <strong>${data.displayName}</strong>,</p>
        <p>Nous avons le plaisir de vous informer que votre demande pour la boutique <strong>"${data.storeName}"</strong> a été approuvée par l'administrateur principal !</p>
        <p>Votre compte boutique est à présent actif et prêt à l'emploi.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${appUrl}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accéder à ma Boutique</a>
        </div>
        <p>Si le bouton ci-dessus ne fonctionne pas, vous pouvez copier-coller le lien suivant dans votre navigateur : <br/>
        <a href="${appUrl}">${appUrl}</a></p>
        <p>Nous vous remercions pour votre confiance.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #6b7280;">Ceci est un message automatique d'information, merci de ne pas y répondre.</p>
      </div>`;
    } else {
      return res.status(400).json({ error: "Type d'email inconnu" });
    }

    // Check if configuration exists
    if (!smtpUser || !smtpPass) {
      console.warn(`[Email Service Warning] SMTP credentials not set. Email not sent, logged to console:
To: ${to}
Subject: ${subject}
Text: ${text}`);
      return res.json({ 
        success: true, 
        mocked: true, 
        message: "Email logged to console (SMTP configuration missing in server environment variables)" 
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text,
        html
      });

      console.log(`[Email Service] Email sent successfully: ${info.messageId}`);
      return res.json({ success: true, messageId: info.messageId });
    } catch (err: any) {
      console.error(`[Email Service Error] Failed to send email to ${to}:`, err);
      
      const isAuthError = err.code === 'EAUTH' || 
                           err.message?.includes('535') || 
                           err.message?.toLowerCase().includes('login') ||
                           err.message?.toLowerCase().includes('username and password') ||
                           err.message?.toLowerCase().includes('credentials');

      if (isAuthError) {
        console.error(`
========================================================================
🚨 [SMTP AUTHENTICATION ERROR]
Nodemailer was unable to authenticate with the SMTP server using:
- Host: ${smtpHost}:${smtpPort}
- User: ${smtpUser}

Possibilités courantes de cette erreur :
1. Si vous utilisez Gmail, l'utilisation d'un mot de passe Gmail normal est bloquée. 
   Vous DEVEZ utiliser un "Mot de passe d'application" (App Password) généré depuis votre compte Google.
2. Vos variables d'environnement SMTP_USER ou SMTP_PASS sont erronées ou ont expiré.
3. Le serveur de messagerie demande une clé API ou n'autorise pas la livraison.

Pour corriger, mettez à jour vos variables d'environnement (SMTP_USER, SMTP_PASS) via les Paramètres.
========================================================================
`);
        
        return res.status(200).json({ 
          success: false, 
          error: "SMTP Authentication Failed (Code 535 / EAUTH)", 
          details: err.message,
          suggestion: "Veuillez utiliser un 'Mot de passe d'application' si vous utilisez Gmail ou vérifier les informations de connexion SMTP."
        });
      }

      const isConnectionError = err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
      if (isConnectionError) {
        console.error(`
========================================================================
🔌 [SMTP CONNECTION ERROR]
Impossible de se connecter au serveur SMTP : ${smtpHost}:${smtpPort}
- Code d'erreur : ${err.code}
- Message : ${err.message}
========================================================================
`);
        return res.status(200).json({
          success: false,
          error: "SMTP Connection Failed",
          details: err.message,
          suggestion: `Veuillez vérifier que l'hôte (${smtpHost}) et le port (${smtpPort}) sont ouverts et opérationnels.`
        });
      }

      return res.status(200).json({ 
        success: false, 
        error: "Failed to send email", 
        details: err.message 
      });
    }
  });

  // Admin route to update secondary user credentials in Firebase Auth
  app.post("/api/admin/update-user-auth", async (req, res) => {
    const { uid, email, password, callerEmail } = req.body;

    if (callerEmail !== "anges.gildas@gmail.com") {
      return res.status(403).json({ success: false, error: "Accès refusé" });
    }

    try {
      // Dynamic import to avoid any static loading side-effects
      const { default: admin } = await import("firebase-admin");
      
      // Lazy init of firebase-admin
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0584738558"
        });
      }

      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      if (Object.keys(updateData).length > 0) {
        await admin.auth().updateUser(uid, updateData);
      }

      return res.json({ success: true, message: "Informations de connexion mises à jour dans Firebase Auth avec succès !" });
    } catch (err: any) {
      console.error("[Admin API Error] Failed to update user Auth credentials:", err);
      return res.status(200).json({
        success: false,
        error: "Erreur Firebase Auth",
        details: err.message || "Impossible de mettre à jour le compte d'authentification",
        suggestion: "Les modifications ont été configurées, mais la mise à jour automatique avec Firebase Auth a rencontré une limitation de droits ou de configuration."
      });
    }
  });

  // Proxy to forward webhook requests securely without browser CORS limitations
  app.post("/api/saas/proxy", async (req, res) => {
    const { url, token, payload } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, error: "L'URL du SaaS est requise" });
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });

      let responseText = "";
      try {
        responseText = await response.text();
      } catch (e) {}

      console.log(`[SaaS Proxy] Response status: ${response.status} from ${url}`);
      return res.json({
        success: response.ok,
        status: response.status,
        response: responseText
      });
    } catch (err: any) {
      console.error("[SaaS Proxy Error] Failed to contact SaaS:", err);
      return res.status(500).json({
        success: false,
        error: "Impossible de contacter l'API du SaaS (serveur injoignable ou certificat invalide)",
        details: err.message
      });
    }
  });

  // Webhook receiver for SaaS to update client stores license from remote SaaS billing/subscriptions
  app.post("/api/saas/webhook", async (req, res) => {
    const { storeId, licenseStatus, licenseExpiry, token } = req.body;
    
    if (!storeId || !licenseStatus) {
      return res.status(400).json({ success: false, error: "storeId et licenseStatus sont requis" });
    }

    try {
      const { default: admin } = await import("firebase-admin");
      
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0584738558"
        });
      }

      const db = admin.firestore();
      
      // Fetch SaaS Token from database to authenticate request
      const globalsSnap = await db.collection("systemConfig").doc("globals").get();
      const globalsData = globalsSnap.data();
      const configToken = globalsData?.saasApiToken;

      const incomingToken = token || req.headers.authorization?.replace("Bearer ", "");

      if (!configToken || incomingToken !== configToken) {
        return res.status(401).json({ success: false, error: "Jeton de sécurité invalide ou non configuré dans l'administration" });
      }

      // Update store settings in Firestore
      const storeRef = db.collection("storeSettings").doc(storeId);
      const storeSnap = await storeRef.get();

      if (!storeSnap.exists) {
        return res.status(404).json({ success: false, error: `Boutique introuvable avec l'ID : ${storeId}` });
      }

      const updatePayload: any = {
        licenseStatus,
        updatedAt: new Date().toISOString()
      };

      if (licenseExpiry) {
        updatePayload.licenseExpiry = licenseExpiry;
      }

      await storeRef.update(updatePayload);

      return res.json({ 
        success: true, 
        message: `Licence de la boutique '${storeSnap.data()?.name || storeId}' mise à jour avec succès via le Webhook SaaS.`,
        updatedStore: { id: storeId, licenseStatus, licenseExpiry }
      });
    } catch (err: any) {
      console.error("[SaaS Webhook API Error]:", err);
      return res.status(500).json({ success: false, error: "Erreur interne du webhook", details: err.message });
    }
  });

  // Vite middleware for development or fallback
  let viteLoaded = false;
  let viteInstance: any = null;
  if (!isProduction) {
    try {
      console.log("[Server] Attempting to load Vite development server...");
      const { createServer: createViteServer } = await import("vite");
      viteInstance = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(viteInstance.middlewares);
      viteLoaded = true;
      console.log("[Server] Vite development middleware successfully mounted.");
    } catch (viteErr) {
      console.warn("[Server Warning] Failed to load Vite development server (probably running in a production container where devDependencies are not installed). Falling back to serving static files.", viteErr);
    }
  }

  // Serve static files if in production or if Vite failed to load as fallback
  if (isProduction || !viteLoaded) {
    const distPath = path.join(process.cwd(), "dist");
    console.log("[Production/Fallback] Serving static files from:", distPath);
    app.use(express.static(distPath));
  }

  // Catch-all fallback handler for all routes to support Client-Side Routing (SPA)
  // This directs any deep links (e.g. /login, /inventory, /pos) back to index.html
  app.get("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes so they correctly return 404 or process normally
    if (url.startsWith("/api/")) {
      return next();
    }

    // Skip files with a file extension to avoid serving index.html for missing images/assets
    const pathname = url.split("?")[0];
    const ext = path.extname(pathname);
    if (ext && ext.length > 1) {
      return next();
    }

    if (!isProduction && viteLoaded && viteInstance) {
      try {
        const fs = await import("fs");
        const indexPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        // Apply Vite's HTML transforms (injects HMR client, CSS, script elements, etc.)
        template = await viteInstance.transformIndexHtml(url, template);
        return res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (err) {
        console.error("[Dev Fallback Error] Failed to send transformed index.html:", err);
        return next(err);
      }
    } else {
      const distPath = path.join(process.cwd(), "dist");
      const indexPath = path.join(distPath, "index.html");
      return res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("[Production Fallback Error] Failed to send index.html:", err);
          return res.status(500).send("Error loading application: static assets are stale or missing. Please contact administrator.");
        }
      });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
