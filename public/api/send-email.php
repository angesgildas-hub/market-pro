<?php
/**
 * Service d'envoi d'e-mails natif PHP pour Hostinger
 * Permet de remplacer l'API Node.js (Express/Nodemailer) sur des hébergements mutualisés
 */

// Configuration des en-têtes CORS pour autoriser l'application React
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Gérer la requête de pré-vérification CORS (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Vérifier que la méthode est bien POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "error" => "Méthode non autorisée. Veuillez utiliser POST."
    ]);
    exit();
}

// Récupérer le corps de la requête des données JSON envoyées par React
$inputJSON = file_get_contents('php://input');
$request = json_decode($inputJSON, true);

if (!$request || !isset($request['type']) || !isset($request['data'])) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "Données requises manquantes ou mal formées."
    ]);
    exit();
}

$type = $request['type'];
$data = $request['data'];

// --- PARAMÈTRES DE CONFIGURATION RECOMMANDÉS ---
// Par défaut, nous utilisons l'envoi de mail() PHP standard de Hostinger qui est très performant.
// Si vous souhaitez utiliser un SMTP externe sécurisé, vous pouvez charger PHPMailer ou modifier ce script.

$fromName = "Market Pro";
// IMPORTANT : Hostinger exige généralement que l'adresse d'expédition ('From') appartienne à votre nom de domaine
// Exemple : noreply@votreboutique.com (sinon le mail risque de finir en spam ou d'être bloqué)
$fromEmail = "noreply@" . ($_SERVER['SERVER_NAME'] ? $_SERVER['SERVER_NAME'] : "marketpro.com");

$to = "";
$subject = "";
$htmlBody = "";

if ($type === "store_requested") {
    // Envoi de l'e-mail de notification d'inscription à l'administrateur principal
    $to = "anges.gildas@gmail.com";
    $subject = "[Market Pro] Nouvelle demande de création de boutique : " . $data['storeName'];
    
    $storeName = htmlspecialchars($data['storeName'], ENT_QUOTES, 'UTF-8');
    $displayName = htmlspecialchars($data['displayName'], ENT_QUOTES, 'UTF-8');
    $email = htmlspecialchars($data['email'], ENT_QUOTES, 'UTF-8');
    $address = htmlspecialchars($data['address'] ?? 'Non spécifiée', ENT_QUOTES, 'UTF-8');
    $country = htmlspecialchars($data['country'] ?? 'Non spécifié', ENT_QUOTES, 'UTF-8');

    $htmlBody = "
    <div style=\"font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px;\">
        <h2 style=\"color: #ea580c; border-bottom: 2px solid #f97316; padding-bottom: 8px; margin-top: 0;\">Nouvelle Demande de Boutique</h2>
        <p>Bonjour Admin,</p>
        <p>Un utilisateur vient de s'inscrire et de soumettre une demande de création de boutique sur Market Pro.</p>
        <div style=\"background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;\">
            <p style=\"margin: 5px 0;\"><strong>Nom de la boutique :</strong> {$storeName}</p>
            <p style=\"margin: 5px 0;\"><strong>Administrateur :</strong> {$displayName}</p>
            <p style=\"margin: 5px 0;\"><strong>Email :</strong> <a href=\"mailto:{$email}\">{$email}</a></p>
            <p style=\"margin: 5px 0;\"><strong>Adresse :</strong> {$address}</p>
            <p style=\"margin: 5px 0;\"><strong>Pays :</strong> {$country}</p>
        </div>
        <p>Veuillez vous rendre sur l'espace Super Admin de Market Pro pour attribuer ou valider la licence.</p>
        <hr style=\"border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;\" />
        <p style=\"font-size: 11px; color: #6b7280; text-align: center;\">Ceci est un message automatique, merci de ne pas y répondre.</p>
    </div>
    ";
} elseif ($type === "store_approved") {
    // Envoi de l'e-mail d'approbation à l'utilisateur de la boutique
    $to = $data['email'];
    $subject = '[Market Pro] Votre boutique "' . $data['storeName'] . '" a été approuvée ! 🎉';

    $storeName = htmlspecialchars($data['storeName'], ENT_QUOTES, 'UTF-8');
    $displayName = htmlspecialchars($data['displayName'], ENT_QUOTES, 'UTF-8');
    
    // Essayer de reconstruire l'URL sécurisée
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $appUrl = $protocol . $_SERVER['SERVER_NAME'];

    $htmlBody = "
    <div style=\"font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px;\">
        <h2 style=\"color: #16a34a; border-bottom: 2px solid #22c55e; padding-bottom: 8px; margin-top: 0;\">Félicitations ! 🎉</h2>
        <p>Bonjour <strong>{$displayName}</strong>,</p>
        <p>Nous avons le plaisir de vous informer que votre demande pour la boutique <strong>\"{$storeName}\"</strong> a été approuvée par l'administrateur principal !</p>
        <p>Votre compte boutique est à présent actif et prêt à l'emploi.</p>
        
        <div style=\"margin: 30px 0; text-align: center;\">
            <a href=\"{$appUrl}\" style=\"background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;\">Accéder à ma Boutique</a>
        </div>
        
        <p>Si le bouton ci-dessus ne fonctionne pas, vous pouvez copier-coller le lien suivant dans votre navigateur : <br/>
        <a href=\"{$appUrl}\">{$appUrl}</a></p>
        
        <hr style=\"border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;\" />
        <p style=\"font-size: 11px; color: #6b7280; text-align: center;\">Ceci est un e-mail de notification noreply, merci de ne pas y répondre.</p>
    </div>
    ";
} else {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "Type d'email inconnu."
    ]);
    exit();
}

// Configuration des en-têtes d'envoi d'e-mail au format HTML UTF-8
$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/html; charset=utf-8';
$headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
$headers[] = 'Reply-To: ' . $fromName . ' <' . $fromEmail . '>';
$headers[] = 'X-Mailer: PHP/' . phpversion();

// Envoi de l'e-mail
if (mail($to, $subject, $htmlBody, implode("\r\n", $headers))) {
    echo json_encode([
        "success" => true,
        "message" => "L'e-mail a été envoyé avec succès !"
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Erreur d'envoi de l'e-mail. Veuillez vérifier la configuration de messagerie de Hostinger."
    ]);
}
?>
