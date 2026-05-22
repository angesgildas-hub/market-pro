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
  const isProduction = process.env.NODE_ENV === "production";

  // Default to port 3000 if PORT is not set
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
        }
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
      return res.status(500).json({ error: "Failed to send email", details: err.message });
    }
  });

  // Vite middleware for development
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    // Since this file is bundled to dist/server.cjs, currentDirname is the dist folder
    const distPath = currentDirname;
    console.log('Serving static files from:', distPath);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
