/* eslint-disable max-len */

const baseWelcomeContent = (customContent, options) => {
  const link = `${process.env.WEBSITE_HOSTNAME}/reset-password/${options.passwordToken.token}`;
  return `<p>Bonjour,</p>
    ${customContent}
    <p>
      Vous pouvez créer votre mot de passe en suivant ce lien: <a href="${link}">${link}</a>.
    </p>
    <p>
      Ce lien expire au bout de 24 heures. Si vous dépassez ce délai, rendez-vous sur
      <a href="${process.env.WEBSITE_HOSTNAME}">${process.env.WEBSITE_HOSTNAME}</a>
      et cliquez sur <i>"C'est ma première connexion”</i>.
    </p>
    <br />
    <p>
      Par la suite, rendez-vous sur
      <a href="${process.env.WEBSITE_HOSTNAME}">${process.env.WEBSITE_HOSTNAME}</a>
      pour vous connecter.
    </p>
    <br />
    <p>Bien cordialement,</p>
    <p>L'équipe ${options.companyName}</p>`;
};

const trainerCustomContent = () => `<p>Bienvenue chez Compani, nous venons de vous créer votre espace Formateur. :)<p>
    <p>Depuis cet espace, vous pourrez gérer en toute simplicité les formations que vous animez pour Compani.<p>`;

const coachCustomContent = () => `<p>Bienvenue chez Compani.<p>
    <p>Depuis cet espace, vous pourrez gérer en toute simplicité les formations Compani dans votre structure.<p>`;

const forgotPasswordEmail = (passwordToken) => {
  const resetPasswordLink = `${process.env.WEBSITE_HOSTNAME}/reset-password/${passwordToken.token}`;

  return `<p>Bonjour,</p>
    <p>Vous pouvez modifier votre mot de passe en cliquant sur le lien suivant (lien valable une heure) :</p>
    <p><a href="${resetPasswordLink}">${resetPasswordLink}</a></p>
    <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ne pas tenir compte de cet email.</p>
    <p>Bien cordialement,<br>
      L'équipe Compani</p>`;
};

const verificationCodeEmail = verificationCode => `<p>Bonjour,</p>
    <p>Votre code Compani : ${verificationCode}. Veuillez utiliser ce code, valable une heure, pour confirmer votre identité.</p>
    <p>Bien cordialement,<br>
      L'équipe Compani</p>`;

const welcomeTraineeContent = () => `<p>Bonjour,</p>
  <p>Bienvenue sur Compani Formation, l'outil au service du prendre soin,
  nous venons de vous créer votre compte apprenant.</p>
  <p>
  Vous y trouverez de nombreuses formations ludiques pour vous accompagner dans votre quotidien : 
  les troubles cognitifs, la communication empathique, gérer la fin de vie et le deuil, et bien d'autres encore... 
  </p>
  <p>
  Nous vous invitons à télécharger l'application Compani Formation sur votre store et
    à cliquer sur “c’est ma première connexion” pour vous créer un mot de passe. 
  </p>
  <p>Bien cordialement,<br>
    L'équipe Compani</p>
  <br>
  ${GooglePlayAndAppStoreButtons()}
  `;

const GooglePlayAndAppStoreButtons = () => `
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td>
        <table cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <a href="https://apps.apple.com/us/app/compani-formation/id1516691161?itsct=apps_box&amp;itscg=30200" style="display: inline-block;">
                <img src="https://storage.googleapis.com/compani-main/appstore-logo.png" alt="Download on the App Store" style="height: 40px;">
              </a>
            </td>
            <td>
              <a href="https://play.google.com/store/apps/details?id=com.alenvi.compani&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1" target="_blank" style="display: inline-block;">
                <img style="height: 60px" alt='Disponible sur Google Play' src='https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png' />
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <p style="color: grey; font-size: 8px">Google Play et le logo Google Play sont des marques de Google LLC.</p>`;

const addTutorContent = (tutorIdentity, tutorEmail, learnerIdentity, courseName, gSheetId) => `<p>Bonjour ${tutorIdentity},</p>
  <p> Merci beaucoup d'avoir accepté d'être tuteur pour ${learnerIdentity ? `${learnerIdentity}` : 'votre apprenant'} ! Nous sommes très heureux de l'accompagner avec vous pendant cette formation "${courseName}".</p>
  ${gSheetId ? `<p> Voici le fichier de suivi de sa formation :</p><p>https://docs.google.com/spreadsheets/d/${gSheetId}</p>` : ''}
  <p>Nous vous avons également créé un compte sur Compani, notre application mobile, qu'il vous faut télécharger sur le magasin d'applications de votre téléphone via les boutons au bas de cet email. Vous pouvez vous y connecter avec votre email : ${tutorEmail}</p>
  <p><strong style="color: red">Nous vous prions de vous connecter uniquement avec cet email.</strong></p>
  <p>Vous y retrouverez tous les rendez-vous de la formation ainsi que les modules théoriques (e-learning) que votre apprenant va suivre et que vous pouvez faire pour l'accompagner dans l'onglet "Mes formations", section "Tutorat".</p>
  <p>Pour information, la formation dédiée aux tuteurs.trices est <strong>obligatoire</strong> et est divisée en trois sessions :</p>
  <ul>
    <li><strong>Session 1 :</strong> Présentation de la formation VAEI (1h30)</li>
    <li><strong>Session 2 :</strong> Rôle tuteur.trice dans l’accompagnement. (1h30)</li>
    <li>Réalisation en autonomie de trois modules e-learning. (4h00)</li>
    <li><strong>Session 3 :</strong> Accompagner la préparation au passage de la VAE Aide-Soignant (1h00)</li>
  </ul>
  <p>À l’issue de la session 1 et 3, un certificat de réalisation vous sera envoyé.</p>
  <p>Nous organisons prochainement la session 1 de la formation des tuteurs.trices VAEI en visioconférence :</p>
  <p><strong>Une invitation Google vous sera envoyée prochainement. Merci de confirmer votre présence, en acceptant l'invitation.</strong></p>
  <p>Cette session sera animée par notre responsable pédagogique, Claire Bolzinger.</p>
  <p>N’hésitez pas à nous écrire pour toute question.</p>
  <p>Bien cordialement,<br>
  L'équipe Compani</p>
  <br>
  ${GooglePlayAndAppStoreButtons()}
`;

const completionCertificateCreationContent = (certificateCreated, errors) => {
  let body = `<p>Script exécuté. ${certificateCreated.length + errors.length} certificats traités.</p>`;

  if (certificateCreated.length) body = body.concat(`<p>Certificat créé pour les apprenants suivants :<br/> ${certificateCreated.map(c => `Formation : ${c.course}, apprenant: ${c.trainee}<br/>`).join('\r\n')}</p>`);

  if (errors.length) body = body.concat(`<p>Certificat à créer manuellement pour les apprenants suivants :<br/> ${errors.map(c => `Formation : ${c.course}, apprenant: ${c.trainee}, mois: ${c.month}<br/>`).join('\r\n')}</p>`);

  return body;
};

module.exports = {
  baseWelcomeContent,
  trainerCustomContent,
  coachCustomContent,
  forgotPasswordEmail,
  verificationCodeEmail,
  welcomeTraineeContent,
  addTutorContent,
  completionCertificateCreationContent,
};
