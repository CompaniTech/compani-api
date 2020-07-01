const handlebars = require('handlebars');
const path = require('path');
const fs = require('fs');

const fsPromises = fs.promises;

const baseWelcomeContent = (customContent, options) => {
  const createPasswordLink = `${process.env.WEBSITE_HOSTNAME}/reset-password/${options.passwordToken.token}`;
  return `<p>Bonjour,</p>
    ${customContent}
    <p>
      Vous pouvez créer votre mot de passe en suivant ce lien: <a href="${createPasswordLink}">${createPasswordLink}</a>.
    </p>
    <p>Ce lien est valable 24heures.</p>
    <p>
      Par la suite, voici le lien pour vous connecter : 
      <a href="${process.env.WEBSITE_HOSTNAME}">${process.env.WEBSITE_HOSTNAME}</a>
    </p>
    <br />
    <p>Bien cordialement,</p>
    <p>L'équipe ${options.companyName}</p>`;
};

const helperCustomContent = () => `<p>
    Votre espace Compani vous permettra de suivre au quotidien le planning des interventions des auxiliaires
    d’envie chez votre proche, ainsi que les éléments de facturation. Si ça n’est pas déjà fait, nous vous remercions
    également de finaliser votre souscription en remplissant la page “Abonnement”.<p>`;

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

const billEmail = async (companyName) => {
  const content = await fsPromises.readFile(path.join(__dirname, '../data/emails/billDispatch.html'), 'utf8');
  const template = handlebars.compile(content);
  return template({ billLink: `${process.env.WEBSITE_HOSTNAME}/customers/documents`, companyName });
};

const completeBillScriptEmailBody = (sentNb, emails) => {
  let body = `<p>Script correctement exécuté. ${sentNb} emails envoyés.</p>`;
  if (emails.length) {
    body = body.concat(`<p>Facture non envoyée à ${emails.join()}</p>`);
  }
  return body;
};

const completeEventRepScriptEmailBody = (nb, repIds) => {
  let body = `<p>Script correctement exécuté. ${nb} répétitions traitées.</p>`;
  if (repIds.length) {
    body = body.concat(`<p>Répétitions à traiter manuellement ${repIds.join()}</p>`);
  }
  return body;
};

const completeRoleUpdateScriptEmailBody = nb => `<p>Script correctement exécuté. ${nb} role(s) mis à jour.</p>`;

const completeEventConsistencyScriptEmailBody = (eventsWithErrors) => {
  let message = `<p>Script correctement exécuté. ${eventsWithErrors.length} evenements avec erreurs.</p>`;
  for (const event of eventsWithErrors) {
    message += `${event.eventId}: ${event.issuesWithEvent}</br>`;
  }
  return message;
};

module.exports = {
  baseWelcomeContent,
  helperCustomContent,
  trainerCustomContent,
  coachCustomContent,
  forgotPasswordEmail,
  billEmail,
  completeBillScriptEmailBody,
  completeEventRepScriptEmailBody,
  completeRoleUpdateScriptEmailBody,
  completeEventConsistencyScriptEmailBody,
};
