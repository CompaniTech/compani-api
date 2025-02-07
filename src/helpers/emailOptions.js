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

const addTutorContent = (learnerIdentity, courseName, tutorIdentity) => `<p>Bonjour ${tutorIdentity},</p>
  <p> Vous avez été ajouté comme tuteur ${learnerIdentity ? `de ${learnerIdentity}` : 'd\'un apprenant'} dans le cadre de la formation ${courseName}.</p>
  <p> Vous pourrez retrouver tout ce qui concerne sa formation sur l'application Compani Formation, onglet "Mes formations", section "Tutorat".</p>
  <p>
  Nous vous invitons à télécharger l'application Compani Formation sur votre store et à cliquer sur "c'est ma première connexion" pour vous créer un mot de passe.
  </p>
  <p>Bien cordialement,<br>
  L'équipe Compani</p>
  <br>
  ${GooglePlayAndAppStoreButtons()}
`;

module.exports = {
  baseWelcomeContent,
  trainerCustomContent,
  coachCustomContent,
  forgotPasswordEmail,
  verificationCodeEmail,
  welcomeTraineeContent,
  addTutorContent,
};
