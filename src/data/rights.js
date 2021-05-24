/* eslint-disable max-len */
const {
  AUXILIARY,
  COACH,
  PLANNING_REFERENT,
  CLIENT_ADMIN,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
  ERP,
} = require('../helpers/constants');

const rights = [
  { permission: 'attendancesheets:edit', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER], description: 'Uploader et supprimer des feuilles d\'émargement' },
  { permission: 'attendancesheets:read', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER, CLIENT_ADMIN, COACH], description: 'Consulter et télécharger des feuilles d\'émargement' },
  { permission: 'bills:edit', rolesConcerned: [CLIENT_ADMIN], subscription: ERP, description: 'Editer une facture ou un avoir' },
  { permission: 'bills:read', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Consulter les informations de facturation' },
  { permission: 'companies:create', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Créer une entreprise' },
  { permission: 'companies:edit', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Editer les informations de la compagnie' },
  { permission: 'companies:read', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Consulter les données des organisations' },
  { permission: 'config:edit', rolesConcerned: [CLIENT_ADMIN], subscription: ERP, description: 'Editer les infos de configuration' },
  { permission: 'config:read', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Consulter les infos de configuration' },
  { permission: 'contracts:edit', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Editer les contrats' },
  { permission: 'courses:create', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Créer une formation' },
  { permission: 'courses:edit', rolesConcerned: [CLIENT_ADMIN, COACH, VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER], description: 'Editer les formations' },
  { permission: 'courses:read', rolesConcerned: [CLIENT_ADMIN, COACH, VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER], description: 'Consulter les données des formations' },
  { permission: 'customers:administrative:edit', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Editer les données administratives de bénéficiaires' },
  { permission: 'customers:create', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Créer ou supprimer des bénéficiaires' },
  { permission: 'customers:edit', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Editer les données de bénéficiaires' },
  { permission: 'customers:read', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Consulter les données de bénéficiaires' },
  { permission: 'customerpartners:edit', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Editer les données de partenaires bénéficiaire' },
  { permission: 'establishments:edit', rolesConcerned: [CLIENT_ADMIN], subscription: ERP, description: 'Editer un établissement' },
  { permission: 'establishments:read', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Consulter la liste des établissements' },
  { permission: 'events:edit', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Editer un évènement' },
  { permission: 'events:read', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Consulter les évènements' },
  { permission: 'exports:edit', rolesConcerned: [CLIENT_ADMIN, COACH], description: 'Exports' },
  { permission: 'exports:read', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Exporter des données' },
  { permission: 'helpers:list', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Consulter la liste des aidants' },
  { permission: 'helpers:edit', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Modifier un aidant' },
  { permission: 'pay:edit', rolesConcerned: [CLIENT_ADMIN], subscription: ERP, description: 'Edition de la paie' },
  { permission: 'pay:read', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Consulter les données de paie' },
  { permission: 'paydocuments:edit', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Editer les documents de paie' },
  { permission: 'payments:edit', rolesConcerned: [CLIENT_ADMIN], subscription: ERP, description: 'Editer un paiement' },
  { permission: 'partnerorganizations:edit', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Editer une structure partenaire' },
  { permission: 'partners:read', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Consulter la liste des partenaires' },
  { permission: 'programs:edit', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Editer les programmes' },
  { permission: 'programs:read', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Consulter les données des programmes' },
  { permission: 'questionnaires:edit', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Editer les questionnaires' },
  { permission: 'questionnaires:read', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER], description: 'Consulter les données des questionnaires' },
  { permission: 'roles:read', rolesConcerned: [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, CLIENT_ADMIN, COACH], description: 'Consulter les roles' },
  { permission: 'scripts:run', rolesConcerned: [VENDOR_ADMIN], subscription: ERP, description: 'Lancer un script' },
  { permission: 'sms:send', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Envoyer un sms' },
  { permission: 'taxcertificates:edit', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Éditer une attestation fiscale' },
  { permission: 'taxcertificates:read', rolesConcerned: [CLIENT_ADMIN, COACH], subscription: ERP, description: 'Consulter une attestation fiscale' },
  { permission: 'timestamp:edit', rolesConcerned: [AUXILIARY, PLANNING_REFERENT], subscription: ERP, description: 'Horodater un évènement' },
  { permission: 'users:edit', rolesConcerned: [CLIENT_ADMIN, COACH, VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER], description: 'Editer un utilisateur' },
  { permission: 'users:exist', rolesConcerned: [CLIENT_ADMIN, COACH, VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER], description: 'Verifier si un email existe déjà en base' },
  { permission: 'users:list', rolesConcerned: [CLIENT_ADMIN, COACH, AUXILIARY, PLANNING_REFERENT, VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER], description: 'Accéder à la liste des utilisateurs' },
];

module.exports = { rights };
