/* eslint-disable max-len */
const { expect } = require('expect');
const moment = require('../../src/extensions/moment');
const app = require('../../server');
const {
  SERVICE,
  AUXILIARY,
  HELPER,
  CUSTOMER,
  FUNDING,
  SUBSCRIPTION,
  SECTOR,
  RUP,
  REFERENT,
  PAY,
  PAYMENT,
  BILL,
  ABSENCE,
  WORKING_EVENT,
  COURSE,
  COURSE_SLOT,
  TRANSPORT,
  END_OF_COURSE,
  COURSE_BILL,
  COURSE_PAYMENT,
  SELF_POSITIONNING,
} = require('../../src/helpers/constants');
const { getToken } = require('./helpers/authentication');
const {
  paymentsList,
  populateDB,
  customersList,
  user,
  billsList,
  creditNotesList,
  auxiliaryList,
  establishment,
  thirdPartyPayer,
  coursesList,
  courseSlotList,
  courseFundingOrganisation,
  programList,
} = require('./seed/exportsSeed');
const { helper, userList } = require('../seed/authUsersSeed');
const { formatPrice } = require('../../src/helpers/utils');
const { authCustomer } = require('../seed/authCustomers');
const { authCompany } = require('../seed/authCompaniesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

const clientHistoryExportTypes = [
  {
    exportType: WORKING_EVENT,
    expectedRows: [
      '\ufeff"Type";"Heure interne";"Service";"Début planifié";"Début horodaté";"Type d\'horodatage";"Motif";"Fin planifiée";"Fin horodatée";"Type d\'horodatage";"Motif";"Durée";"Répétition";"Déplacement véhiculé avec bénéficiaire";"Mode de transport spécifique";"Équipe";"Id Auxiliaire";"Auxiliaire - Titre";"Auxiliaire - Prénom";"Auxiliaire - Nom";"A affecter";"Id Bénéficiaire";"Bénéficiaire - Titre";"Bénéficiaire - Nom";"Bénéficiaire - Prénom";"Divers";"Facturé";"Annulé";"Statut de l\'annulation";"Raison de l\'annulation"',
      `"Intervention";;"Service 1";"2019/01/17 15:35:19";"2019/01/17 15:37:19";"Manuel";"QR Code manquant";"2019/01/17 17:30:19";"2019/01/17 17:35:19";"QR Code";;"2,00";"Tous les jours";"23,00";"Transports en commun / À pied";"Etoile";;;;;"Oui";${customersList[3]._id.toHexString()};"M.";"BARDET";"Romain";;"Non";"Non";;`,
      `"Heure interne";"planning";;"2019/01/17 15:30:19";;;;"2019/01/17 17:30:19";;;;"2,00";;;;"Etoile";${auxiliaryList[0]._id.toHexString()};"M.";"Lulu";"UIUI";"Non";;;;;;"Non";"Non";;`,
      `"Intervention";;"Service 1";"2019/01/16 10:30:19";;;;"2019/01/16 12:30:21";;;;"2,00";;;;"Etoile";${auxiliaryList[0]._id.toHexString()};"M.";"Lulu";"UIUI";"Non";${customersList[3]._id.toHexString()};"M.";"BARDET";"Romain";"test";"Non";"Oui";"Facturée & payée";"Initiative de l'intervenant(e)"`,
    ],
    query: 'startDate=2019-01-15T10:00:00.000Z&endDate=2019-01-20T10:00:00.000Z',
  },
  {
    exportType: ABSENCE,
    expectedRows: [
      '\ufeff"Id Auxiliaire";"Auxiliaire - Prénom";"Auxiliaire - Nom";"Auxiliaire - Titre";"Équipe";"Type";"Nature";"Début";"Fin";"Equivalent heures contrat";"Prolongation";"Absence d\'origine";"Divers"',
      `${auxiliaryList[0]._id.toHexString()};"Lulu";"UIUI";"M.";"Etoile";"Absence injustifiée";"Horaire";"19/01/2019 14:00";"19/01/2019 16:00";"2,00";"non";;"test absence"`,
      `${auxiliaryList[0]._id.toHexString()};"Lulu";"UIUI";"M.";"Etoile";"Congé";"Journalière";"19/01/2019";"21/01/2019";"4,00";"non";;`,
    ],
    query: 'startDate=2019-01-15T10:00:00.000Z&endDate=2019-01-21T10:00:00.000Z',
  },
  {
    exportType: BILL,
    expectedRows: [
      '\ufeff"Nature";"Identifiant";"Date";"Id Bénéficiaire";"Titre";"Nom";"Prénom";"Id tiers payeur";"Tiers payeur";"Montant HT en €";"Montant TTC en €";"Nombre d\'heures";"Services";"Date de création"',
      `"Facture";"FACT-1905002";"29/05/2019";"${billsList[0].customer.toHexString()}";"M.";"BARDET";"Romain";"${billsList[0].thirdPartyPayer.toHexString()}";"Toto";"72,00";"75,96";"8,00";"Temps de qualité - autonomie - 8,00h - ${formatPrice(billsList[0].subscriptions[0].inclTaxes)} TTC";"${moment().format('DD/MM/YYYY')}"`,
      `"Facture";"FACT-1905003";"25/05/2019";"${billsList[1].customer.toHexString()}";"M.";"BARDET";"Romain";;;"96,00";"101,28";"4,00";"Temps de qualité - autonomie - 4,00h - ${formatPrice(billsList[1].subscriptions[0].inclTaxes)} TTC";"${moment().format('DD/MM/YYYY')}"`,
      `"Avoir";;"28/05/2019";"${creditNotesList[0].customer.toHexString()}";"M.";"BARDET";"Romain";"${thirdPartyPayer._id}";"Toto";"110,00";"202,00";;"toto";"${moment().format('DD/MM/YYYY')}"`,
    ],
    query: 'startDate=2019-05-25T10:00:00.000Z&endDate=2019-05-29T10:00:00.000Z',
  },
  {
    exportType: PAYMENT,
    expectedRows: [
      '\ufeff"Nature";"Identifiant";"Date";"Id Bénéficiaire";"Titre";"Nom";"Prénom";"Id tiers payeur";"Tiers payeur";"Moyen de paiement";"Montant TTC en €"',
      `"Remboursement";"REG-1903203";"27/05/2019";"${paymentsList[0].customer}";"M.";"BARDET";"Romain";"${paymentsList[0].thirdPartyPayer}";"Toto";"Prélèvement";"220,00"`,
      `"Paiement";"REG-1903201";"26/05/2019";"${paymentsList[1].customer}";"M.";"BARDET";"Romain";"${paymentsList[0].thirdPartyPayer}";"Toto";"Prélèvement";"190,00"`,
    ],
    query: 'startDate=2019-05-25T10:00:00.000Z&endDate=2019-05-31T10:00:00.000Z',
  },
  {
    exportType: PAY,
    expectedRows: [
      '\ufeff"Id Auxiliaire";"Titre";"Prénom";"Nom";"Equipe";"Date d\'embauche";"Début";"Date de notif";"Motif";"Fin";"Heures contrat";"Heures absences";"Heures à travailler";"Heures travaillées";"Dont exo non majo";"Dont exo et majo";"Détails des majo exo";"Dont non exo et non majo";"Dont non exo et majo";"Détails des majo non exo";"Heures transports";"Solde heures";"Dont diff mois précédent";"Compteur";"Heures sup à payer";"Heures comp à payer";"Mutuelle";"Remboursement transport";"Km payés";"Km parcourus";"Frais téléphoniques";"Prime";"Indemnité"',
      `${auxiliaryList[0]._id.toHexString()};"M.";"Lulu";"UIUI";"Etoile";"01/01/2018";"01/01/2019";;;"31/01/2019";"151,00";"10,00";"30,00";"143,00";"99,00";"2,00";;"45,00";"5,00";;"6,00";"0,00";"8,00";"-20,00";"0,00";"0,00";"Non";"10,00";"12,00";"14,00";"0,00";"0,00";"0,00"`,
      `${auxiliaryList[0]._id.toHexString()};"M.";"Lulu";"UIUI";"Etoile";"01/01/2018";"01/01/2019";;;"28/02/2019";"151,00";"10,00";"20,00";"143,00";"99,00";"2,00";;"45,00";"5,00";;"6,00";"0,00";"8,00";"-20,00";"0,00";"0,00";"Non";"10,00";"12,00";"14,00";"0,00";"0,00";"0,00"`,
      `${auxiliaryList[0]._id.toHexString()};"M.";"Lulu";"UIUI";"Etoile";"01/01/2018";"01/01/2019";"25/01/2019";;"31/01/2019";"151,00";"10,00";"20,00";"143,00";"99,00";"2,00";;"45,00";"5,00";;"6,00";"0,00";"8,00";"-20,00";"0,00";"0,00";"Non";"10,00";"12,00";"14,00";"0,00";"0,00";"10,00"`,
      `${auxiliaryList[0]._id.toHexString()};"M.";"Lulu";"UIUI";"Etoile";"01/01/2018";"01/01/2019";"25/02/2019";;"28/02/2019";"151,00";"10,00";"20,00";"143,00";"99,00";"2,00";;"45,00";"5,00";;"6,00";"0,00";"8,00";"-20,00";"0,00";"0,00";"Non";"10,00";"12,00";"14,00";"0,00";"0,00";"10,00"`,
    ],
    query: 'startDate=2019-01-01T10:00:00.000Z&endDate=2019-05-31T10:00:00.000Z',
  },
  {
    exportType: TRANSPORT,
    expectedRows: [
      '\ufeff"Id de l\'auxiliaire";"Prénom de l\'auxiliaire";"Nom de l\'auxiliaire";"Heure de départ du trajet";"Heure d\'arrivée du trajet";"Adresse de départ";"Adresse d\'arrivée";"Distance";"Mode de transport";"Durée du trajet";"Durée inter vacation";"Pause prise en compte";"Durée rémunérée"',
      `"${auxiliaryList[0]._id}";"Lulu";"Uiui";"11/01/2019 09:30:00";"11/01/2019 10:30:00";"42 Rue de la Procession 75015 Paris";"37 Rue de Ponthieu 75008 Paris";"0,230";"Transports en commun / À pied";"0,0639";"1,0000";"Non";"0,0639"`,
      `"${auxiliaryList[1]._id}";"Lili";"Lolo";"11/01/2019 11:30:00";"11/01/2019 12:35:00";"42 Rue de la Procession 75015 Paris";"35 Rue du Test 75015 Paris";"0,230";"Véhicule personnel";"1,0833";"1,0833";"Oui";"1,0833"`,
    ],
    query: 'startDate=2019-01-01&endDate=2019-01-31',
  },
];

const vendorHistoryExportTypes = [
  {
    exportType: COURSE,
    expectedRows: [
      '\ufeff"Identifiant";"Type";"Payeur";"Structure";"Société mère";"Programme";"Id programme";"Sous-Programme";"Infos complémentaires";"Intervenant·es";"Début de formation";"Fin de formation";"Chargé des opérations";"Contact pour la formation";"Nombre d\'inscrits";"Nombre de dates";"Nombre de créneaux";"Nombre de créneaux à planifier";"Durée Totale";"Nombre de SMS envoyés";"Nombre de personnes connectées à l\'app";"Complétion eLearning moyenne";"Nombre de réponses au questionnaire de recueil des attentes";"Nombre de réponses au questionnaire de satisfaction";"Date de démarrage souhaitée";"Première date de démarrage souhaitée";"Nombre de feuilles d\'émargement chargées";"Nombre de présences";"Nombre d\'absences";"Nombre de stagiaires non prévus";"Nombre de présences non prévues";"Avancement";"Archivée";"Date d\'archivage";"Prix de la formation";"Nombre de factures";"Facturée";"Montant facturé";"Montant réglé";"Solde";"Date de création"',
      `${coursesList[0]._id};"Intra";"APA Paris";"Test SAS";;"Program 1";${programList[0]._id};"subProgram 1";"group 1";"Gilles FORMATEUR, Simon TRAINERANDCOACH";"01/05/2021";"01/05/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";3;1;2;0;"4,00";2;1;"0,00";2;1;;;1;2;4;0;0;"1,00";"Oui";"08/07/2024";"${formatPrice(coursesList[0].prices[0].global)}";"1 sur 1";"Oui";"1200,00";"1150,00";"-50,00";"07/01/2018"`,
      `${coursesList[5]._id};"Intra";"APA Paris,Test SAS";"Test SAS";;"Program 1";${programList[0]._id};"subProgram 1";"group 6";"Gilles FORMATEUR";"12/04/2021";"12/04/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";3;1;1;0;"2,00";0;1;"0,00";0;0;;;0;0;3;0;0;"1,00";"Non";;;"2 sur 3";"Non";"880,00";"200,00";"-680,00";"07/01/2018"`,
      `${coursesList[6]._id};"Intra";;"Test SAS";;"Program 1";${programList[0]._id};"subProgram 1";"group 7";"Gilles FORMATEUR";"12/04/2021";"12/04/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";0;1;1;0;"2,00";0;0;"0,00";0;0;;;0;0;0;0;0;"1,00";"Non";;;"0 sur 0";"Non";;;;"07/01/2018"`,
      `${coursesList[1]._id};"Inter B2B";"APA Paris";"Test SAS,Un autre SAS";;"Program 2";${programList[1]._id};"subProgram 2";;"Gilles FORMATEUR";"01/02/2021";;"Aline CONTACT-COM";"Aline CONTACT-COM";2;2;2;1;"4,00";1;0;"0,67";1;1;"01/01/2019";"24/10/2018";0;2;2;1;2;"0,67";"Non";;"\nTest SAS: ${formatPrice(coursesList[1].prices[0].global)} (+ FF: ${formatPrice(coursesList[1].prices[0].trainerFees)})\nUn autre SAS: ${formatPrice(coursesList[1].prices[1].global)}";"2 sur 2";"Oui";"800,00";"300,00";"-500,00";"07/01/2018"`,
      `${coursesList[2]._id};"Inter B2B";;"Test SAS,Test SAS withtout subscription,Un autre SAS";;"Program 2";${programList[1]._id};"subProgram 2";"group 3";"Gilles FORMATEUR";;;"Aline CONTACT-COM";"Aline CONTACT-COM";3;0;0;0;"0,00";0;0;"0,44";0;1;"12/01/2022";"12/01/2022";0;0;0;0;0;;"Non";;"\nTest SAS: ${formatPrice(coursesList[2].prices[0].global)}";"0 sur 3";"Non";;;;"07/01/2018"`,
      `${coursesList[7]._id};"Intra société mère";;;"Société mère";"Program 1";${programList[0]._id};"subProgram 1";"group 8";"Gilles FORMATEUR";"16/01/2021";"16/01/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";0;1;1;0;"2,00";0;0;"0,00";0;0;;;0;0;0;0;0;"1,00";"Non";;;"0 sur 0";"Non";;;;"07/01/2018"`,
      `${coursesList[3]._id};"Intra";;"Test SAS";;"Program 1";${programList[0]._id};"subProgram 1";"group 4";"Gilles FORMATEUR";"01/02/2021";"10/02/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";2;3;3;0;"11,00";0;1;"0,00";0;0;;;0;0;6;0;0;"1,00";"Non";;;"0 sur 1";"Non";;;;"07/01/2018"`,
      `${coursesList[8]._id};"Intra";;"Un autre SAS";;"Program 1";${programList[0]._id};"subProgram 1";"group 9";"Gilles FORMATEUR";"01/05/2021";"01/05/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";1;1;1;0;"2,00";0;1;"0,00";0;1;;;0;1;0;0;0;"1,00";"Non";;;"0 sur 1";"Non";;;;"07/01/2018"`,
      `${coursesList[9]._id};"Individuelle";;"Un autre SAS";;"Program 1";${programList[0]._id};"subProgram 1";"single";"Gilles FORMATEUR";"01/05/2021";"01/05/2021";"Aline CONTACT-COM";"Aline CONTACT-COM";1;1;1;0;"2,00";0;1;"0,00";0;0;;;0;0;1;0;0;"1,00";"Non";;;"0 sur 1";"Non";;;;"07/01/2018"`,
    ],
    query: 'startDate=2021-01-15T10:00:00.000Z&endDate=2022-01-20T10:00:00.000Z',
  },
  {
    exportType: COURSE_SLOT,
    expectedRows: [
      '\ufeff"Id Créneau";"Id Formation";"Formation";"Étape";"Type";"Date de création";"Date de début";"Date de fin";"Durée";"Adresse";"Nombre de présences";"Nombre d\'absences";"Nombre de présences non prévues"',
      `${courseSlotList[0]._id};${coursesList[0]._id};"Test SAS - Program 1 - group 1";"étape 1";"présentiel";"12/12/2020 11:00:00";"01/05/2021 10:00:00";"01/05/2021 12:00:00";"2,00";"24 Avenue Daumesnil 75012 Paris";1;2;0`,
      `${courseSlotList[1]._id};${coursesList[0]._id};"Test SAS - Program 1 - group 1";"étape 2";"distanciel";"12/12/2020 11:00:01";"01/05/2021 16:00:00";"01/05/2021 18:00:00";"2,00";"https://meet.google.com";1;2;0`,
      `${courseSlotList[2]._id};${coursesList[1]._id};"Program 2";"étape 1";"présentiel";"12/12/2020 11:00:02";"01/02/2021 09:00:00";"01/02/2021 11:00:00";"2,00";"24 Avenue Daumesnil 75012 Paris";1;1;1`,
      `${courseSlotList[3]._id};${coursesList[1]._id};"Program 2";"étape 3";"eLearning";"12/12/2020 11:00:03";"02/02/2021 09:00:00";"02/02/2021 11:00:00";"2,00";;1;1;1`,
      `${courseSlotList[5]._id};${coursesList[5]._id};"Test SAS - Program 1 - group 6";"étape 1";"présentiel";"12/12/2020 11:00:04";"12/04/2021 12:00:00";"12/04/2021 14:00:00";"2,00";"24 Avenue Daumesnil 75012 Paris";0;3;0`,
      `${courseSlotList[6]._id};${coursesList[6]._id};"Test SAS - Program 1 - group 7";"étape 1";"présentiel";"12/12/2020 11:00:04";"12/04/2021 12:00:00";"12/04/2021 14:00:00";"2,00";"24 Avenue Daumesnil 75012 Paris";0;0;0`,
      `${courseSlotList[8]._id};${coursesList[3]._id};"Test SAS - Program 1 - group 4";"étape 1";"présentiel";"14/10/2020 23:00:00";"01/02/2021 10:00:00";"01/02/2021 13:00:00";"3,00";"24 Avenue Daumesnil 75012 Paris";0;2;0`,
      `${courseSlotList[9]._id};${coursesList[3]._id};"Test SAS - Program 1 - group 4";"étape 2";"distanciel";"14/10/2020 23:00:10";"10/02/2021 09:00:00";"10/02/2021 13:00:00";"4,00";;0;2;0`,
      `${courseSlotList[10]._id};${coursesList[3]._id};"Test SAS - Program 1 - group 4";"étape 1";"présentiel";"14/10/2020 23:00:30";"03/02/2021 09:00:00";"03/02/2021 13:00:00";"4,00";"24 Avenue Daumesnil 75012 Paris";0;2;0`,
      `${courseSlotList[11]._id};${coursesList[8]._id};"Un autre SAS - Program 1 - group 9";"étape 2";"distanciel";"12/12/2020 11:00:01";"01/05/2021 16:00:00";"01/05/2021 18:00:00";"2,00";"https://meet.google.com";1;0;0`,
      `${courseSlotList[12]._id};${coursesList[9]._id};"Program 1 - single";"étape 2";"distanciel";"12/12/2020 11:00:01";"01/05/2021 16:00:00";"01/05/2021 18:00:00";"2,00";"https://meet.google.com";0;1;0`,
    ],
    query: 'startDate=2021-02-01T10:00:00.000Z&endDate=2022-01-20T10:00:00.000Z',
  },
  {
    exportType: END_OF_COURSE,
    expectedRows: [
      '\ufeff"Id formation";"Programme";"Sous-programme";"Prénom Nom intervenant·e";"Structure";"Date de réponse";"Origine de réponse";"Prénom Nom répondant(e)";"Mail répondant(e)";"Numéro de tél répondant(e)";"Où est Charlie ?";"Comment gagner 100 euros par heure sans travailler ?";"Combien coûte une chocolatine ?"',
      `${coursesList[0]._id};"Program 1";"subProgram 1";"Gilles FORMATEUR, Simon TRAINERANDCOACH";"Test SAS";"20/01/2021 11:31:37";"webapp";"Jacques TRAINEE";"trainee1@compani.fr";;"dans ton couloir";"3";"15 euros"`,
      `${coursesList[2]._id};"Program 2";"subProgram 2";"Gilles FORMATEUR";"Test SAS withtout subscription";"10/12/2021 21:30:04";"mobile";"Lulu UIUI";"export_auxiliary_1@alenvi.io";"+33 1 23 45 67 89";;;"15 euros"`,
      `${coursesList[8]._id};"Program 1";"subProgram 1";"Gilles FORMATEUR";"Un autre SAS";"27/01/2021 21:31:04";"mobile";"Paul TRAINEE";"trainee2@compani.fr";;;;"15 centimes,15 euros"`,
    ],
    query: 'startDate=2021-01-15T10:00:00.000Z&endDate=2022-01-20T10:00:00.000Z',
  },
  {
    exportType: COURSE_BILL,
    expectedRows: [
      '\ufeff"Nature";"Identifiant";"Date";"Id formation";"Formation";"Programme";"Structure";"Id payeur";"Payeur";"Montant TTC";"Montant réglé";"Document lié";"Montant soldé";"Solde";"Avancement";"Début de la formation";"Milieu de la formation";"Fin de la formation"',
      `"Facture";"FACT-00001";"08/03/2022";${coursesList[0]._id};"Test SAS - Program 1 - group 1";"Program 1";"Test SAS";${courseFundingOrganisation._id};"APA Paris";"1200,00";"1150,00";;;"-50,00";"1,00";"01/05/2021";"01/05/2021";"01/05/2021"`,
      `"Facture";"FACT-00002";"08/03/2022";${coursesList[3]._id};"Test SAS - Program 1 - group 4";"Program 1";"Test SAS";${courseFundingOrganisation._id};"APA Paris";"1200,00";"0,00";"AV-00001";"1200,00";"0,00";"1,00";"01/02/2021";"03/02/2021";"10/02/2021"`,
      `"Facture";"FACT-00005";"08/03/2022";${coursesList[1]._id};"Program 2";"Program 2";"Un autre SAS";${courseFundingOrganisation._id};"APA Paris";"400,00";"-100,00";;;"-500,00";"0,67";"01/02/2021";"02/02/2021";`,
      `"Avoir";"AV-00002";"09/03/2022";${coursesList[5]._id};"Test SAS - Program 1 - group 6";"Program 1";"Test SAS";${authCompany._id};"Test SAS";"240,00";;"FACT-00008";;;;;;`,
    ],
    query: 'startDate=2022-03-01T10:00:00.000Z&endDate=2022-04-20T10:00:00.000Z',
  },
  {
    exportType: COURSE_PAYMENT,
    expectedRows: [
      '\ufeff"Nature";"Identifiant";"Date";"Facture associée";"Id payeur facture";"Numéro du paiement (parmi ceux de la même facture)";"Moyen de paiement";"Montant"',
      `"Paiement";"REG-00001";"09/03/2022";"FACT-00001";${courseFundingOrganisation._id};1;"Prélèvement";"1100,00"`,
      `"Paiement";"REG-00003";"09/03/2022";"FACT-00005";${courseFundingOrganisation._id};1;"Espèces";"300,00"`,
      `"Paiement";"REG-00006";"01/04/2022";"FACT-00001";${courseFundingOrganisation._id};2;"Prélèvement";"50,00"`,
      `"Remboursement";"REMB-00001";"11/03/2022";"FACT-00005";${courseFundingOrganisation._id};2;"Chèque";"200,00"`,
    ],
    query: 'startDate=2022-03-01T10:00:00.000Z&endDate=2022-04-20T10:00:00.000Z',
  },
  {
    exportType: SELF_POSITIONNING,
    expectedRows: [
      '\ufeff"Id formation";"Programme";"Infos complémentaires";"Sous-programme";"Prénom Nom intervenant";"Nombre d\'apprenants inscrits";"Nombre de réponses au questionnaire de début";"Moyenne de l’auto-positionnement de début";"Nombre de réponses au questionnaire de fin";"Moyenne de l’auto-positionnement de fin";"Delta entre la moyenne de début et de fin";"Question ayant la plus grande progression";"Progression maximale associée";"Question ayant la plus faible progression";"Progression minimale associée"',
      `${coursesList[0]._id};"Program 1";"group 1";"subProgram 1";"Gilles FORMATEUR, Simon TRAINERANDCOACH";3;3;"3,22";2;"3,50";"0,28";"Je me sens capable de proposer une animation adaptée a tous les residents";"1,17";"Je me sens capable de cuisiner avec un groupe de residents";"-0,67"`,
      `${coursesList[3]._id};"Program 1";"group 4";"subProgram 1";"Gilles FORMATEUR";2;2;"1,33";2;"3,83";"2,50";"Je me sens capable de faire la toilette d'un résident seule";"3,00";"Je me sens capable de cuisiner avec un groupe de residents";"2,00"`,
    ],
    query: 'startDate=2021-01-01T10:00:00.000Z&endDate=2021-05-05T10:00:00.000Z',
  },
];

clientHistoryExportTypes.forEach(({ exportType, expectedRows, query }) => {
  describe(`EXPORTS ROUTES - GET /exports/${exportType}/history`, () => {
    let authToken;
    before(populateDB);

    describe('COACH', () => {
      beforeEach(async () => {
        authToken = await getToken('coach');
      });

      it(`should get ${exportType}`, async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/exports/${exportType}/history?${query}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);

        const rows = response.result.split('\r\n');
        expect(rows.length).toBe(expectedRows.length);

        for (let i = 0; i < expectedRows.length; i++) expect(rows.some(r => r === expectedRows[i])).toBeTruthy();
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'planning_referent', expectedCode: 403 },
        { name: 'vendor_admin', expectedCode: 403 },
        { name: 'client_admin', expectedCode: 403, erp: false },
      ];
      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
          authToken = await getToken(role.name, role.erp);
          const response = await app.inject({
            method: 'GET',
            url: `/exports/${exportType}/history?${query}`,
            headers: { Cookie: `alenvi_token=${authToken}` },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });
});

vendorHistoryExportTypes.forEach(({ exportType, expectedRows, query }) => {
  describe(`EXPORTS ROUTES - GET /exports/${exportType}/history #tag`, () => {
    let authToken;
    before(populateDB);

    describe('TRAINING_ORGANISATION_MANAGER', () => {
      beforeEach(async () => {
        authToken = await getToken('training_organisation_manager');
      });

      it(`should get ${exportType}`, async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/exports/${exportType}/history?${query}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);

        const rows = response.result.split('\r\n');
        expect(rows.length).toBe(expectedRows.length);

        for (let i = 0; i < expectedRows.length; i++) expect(rows.some(r => r === expectedRows[i])).toBeTruthy();
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'planning_referent', expectedCode: 403 },
        { name: 'client_admin', expectedCode: 403 },
        { name: 'trainer', expectedCode: 403 },
      ];
      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
          authToken = await getToken(role.name, role.erp);
          const response = await app.inject({
            method: 'GET',
            url: `/exports/${exportType}/history?${query}`,
            headers: { Cookie: `alenvi_token=${authToken}` },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });
});

const dataExportTypes = [
  {
    exportType: SERVICE,
    expectedRows: [
      '\ufeff"Nature";"Entreprise";"Nom";"Montant unitaire par défaut";"TVA (%)";"Plan de majoration";"Date de début";"Date de création";"Date de mise a jour"',
      `"Horaire";"Test SAS";"Service 1";"24,00";"0,00";;"16/01/2019";"${moment().format('DD/MM/YYYY')}";"${moment().format('DD/MM/YYYY')}"`,
      `"Horaire";"Test SAS";"Service 2";"24,00";"12,00";;"18/01/2019";"${moment().format('DD/MM/YYYY')}";"${moment().format('DD/MM/YYYY')}"`,
      `"Forfaitaire";"Test SAS";"Service forfaitaire";"100,00";"12,00";;"18/01/2019";"${moment().format('DD/MM/YYYY')}";"${moment().format('DD/MM/YYYY')}"`,
    ],
  },
  {
    exportType: AUXILIARY,
    expectedRows: [
      '\ufeff"Email";"Équipe";"Id Auxiliaire";"Titre";"Nom";"Prénom";"Date de naissance";"Pays de naissance";"Departement de naissance";"Ville de naissance";"Nationalité";"N° de sécurité sociale";"Addresse";"Téléphone";"Nombre de contrats";"Établissement";"Date de début de contrat prestataire";"Date de fin de contrat prestataire";"Date d\'inactivité";"Date de création";"Mode de transport par défaut"',
      `"auxiliary@alenvi.io";"Test";${userList[2]._id};"M.";"OLAIT";"Auxiliary";;;;;;;;;0;;;;;"${moment().format('DD/MM/YYYY')}";"Véhicule personnel"`,
      `"auxiliary-without-company@alenvi.io";;${userList[3]._id};;"CRÉOLE";"Auxiliary without company";;;;;;;;;0;;;;;"${moment().format('DD/MM/YYYY')}";`,
      `"planning-referent@alenvi.io";"Test";${userList[4]._id};"Mme";"TEST";"PlanningReferent";;;;;;;;;0;;;;;"${moment().format('DD/MM/YYYY')}";`,
      `"export_auxiliary_1@alenvi.io";"Etoile";${auxiliaryList[0]._id};"M.";"UIUI";"Lulu";"01/01/1992";"France";"75";"Paris";"Française";12345678912345;"37 rue de ponthieu 75008 Paris";"0123456789";2;"${establishment.name}";"01/01/2018";"01/01/2020";;"${moment().format('DD/MM/YYYY')}";"Transports en commun / À pied"`,
      `"export_auxiliary_1@alenvi.io";"Etoile";${auxiliaryList[0]._id};"M.";"UIUI";"Lulu";"01/01/1992";"France";"75";"Paris";"Française";12345678912345;"37 rue de ponthieu 75008 Paris";"0123456789";2;"${establishment.name}";"01/02/2020";;;"${moment().format('DD/MM/YYYY')}";"Transports en commun / À pied"`,
      `"export_auxiliary_2@alenvi.io";;${auxiliaryList[1]._id};"M.";"LOLO";"Lili";"01/01/1992";"France";"75";"Paris";"Française";12345678912345;"37 rue de ponthieu 75008 Paris";"0123456789";1;"${establishment.name}";"01/02/2020";;;"${moment().format('DD/MM/YYYY')}";"Véhicule personnel"`,
    ],
  },
  {
    exportType: HELPER,
    expectedRows: [
      '\ufeff"Email";"Téléphone";"Id Aidant(e)";"Aidant(e) - Nom";"Aidant(e) - Prénom";"Id Bénéficiaire";"Bénéficiaire - Titre";"Bénéficiaire - Nom";"Bénéficiaire - Prénom";"Bénéficiaire - Rue";"Bénéficiaire - Code postal";"Bénéficiaire - Ville";"Date de création"',
      `"helper@alenvi.io";;${helper._id.toHexString()};"TEST";"Helper";${authCustomer._id.toHexString()};"M.";"LACORDÉE";"vian";"37 rue de Ponthieu";"75008";"Paris";"${moment().format('DD/MM/YYYY')}"`,
      `"toto@alenvi.io";"+33123456789";${user._id.toHexString()};"TOTO";"test";${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";"37 rue de Ponthieu";"75008";"Paris";"${moment().format('DD/MM/YYYY')}"`,
    ],
  },
  {
    exportType: CUSTOMER,
    expectedRows: [
      '\ufeff"Id Bénéficiaire";"Titre";"Nom";"Prenom";"Date de naissance";"Adresse";"Ville";"1ère intervention";"Id Auxiliaire référent(e)";"Auxiliaire référent(e)";"Situation";"Environnement";"Objectifs";"Autres";"Nom associé au compte bancaire";"IBAN";"BIC";"RUM";"Date de signature du mandat";"Nombre de souscriptions";"Souscriptions";"Nombre de financements";"Date de création";"Statut"',
      `${authCustomer._id.toHexString()};"M.";"LACORDÉE";"vian";;"37 rue de ponthieu 75008 Paris";"Paris";;;;"Non renseigné";;;;;;;;;0;;0;"${moment().format('DD/MM/YYYY')}";"Actif"`,
      `${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";"01/01/1940";"37 rue de ponthieu 75008 Paris";"Paris";"17/01/2020";${auxiliaryList[0]._id};"Lulu Uiui";"Domicile";"test";"toto";"123456789";"Test Toto";"FR6930003000405885475816L80";"ABNAFRPP";;;2;"Service 1`,
      ` Service forfaitaire";1;"${moment().format('DD/MM/YYYY')}";"Archivé"`,
      `${customersList[1]._id.toHexString()};"M.";"BERNAL";"Egan";;"37 rue de ponthieu 75008 Paris";"Paris";;${auxiliaryList[0]._id};"Lulu Uiui";"EHPAD";;;;;;;;;0;;0;"${moment().format('DD/MM/YYYY')}";"Arrêté"`,
      `${customersList[2]._id.toHexString()};"M.";"ALAPHILIPPE";"Julian";;"37 rue de ponthieu 75008 Paris";"Paris";;;;"Domicile";;;;;;;;;0;;0;"${moment().format('DD/MM/YYYY')}";"Actif"`,
      `${customersList[3]._id.toHexString()};"M.";"BARDET";"Romain";;"37 rue de ponthieu 75008 Paris";"Paris";"11/01/2019";;;"Non renseigné";;;;;;;;;1;"Service 1";1;"${moment().format('DD/MM/YYYY')}";"Actif"`,
    ],
  },
  {
    exportType: FUNDING,
    expectedRows: [
      '\ufeff"Id Bénéficiaire";"Titre";"Nom";"Prénom";"Id tiers payeur";"Tiers payeur";"Code EPA";"Nature";"Service";"Date de début";"Date de fin";"Numéro de dossier";"Fréquence";"Montant TTC";"Montant unitaire TTC";"Nombre d\'heures";"Jours";"Participation du/de la bénéficiaire"',
      `${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";${billsList[0].thirdPartyPayer.toHexString()};"Toto";;"Forfaitaire";"Service 1";"03/02/2018";;"12345";"Mensuelle";"21,00";"10,00";"9,00";"Lundi Mardi Mercredi";"12,00"`,
      `${customersList[3]._id.toHexString()};"M.";"BARDET";"Romain";${billsList[0].thirdPartyPayer.toHexString()};"Toto";;"Forfaitaire";"Service 1";"02/02/2020";;"D123456";"Une seule fois";"1600,00";;;"Lundi Mardi Mercredi Jeudi Vendredi Samedi";"66,00"`,
    ],
  },
  {
    exportType: SUBSCRIPTION,
    expectedRows: [
      '\ufeff"Id Bénéficiaire";"Titre";"Nom";"Prénom";"Service";"Prix unitaire TTC";"Volume horaire hebdomadaire estimatif";"Nombre d\'interventions hebdomadaire estimatif";"Dont soirées";"Dont samedis";"Dont dimanches"',
      `${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";"Service 1";"12,00";"30,00";"0,00";"1,00";"2,00";"2,00"`,
      `${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";"Service forfaitaire";"100,00";;"3,00";;;`,
      `${customersList[3]._id.toHexString()};"M.";"BARDET";"Romain";"Service 1";"12,00";"12,00";"0,00";"2,00";;"1,00"`,
    ],
  },
  {
    exportType: SECTOR,
    expectedRows: [
      '\ufeff"Equipe";"Id Auxiliaire";"Nom";"Prénom";"Date d\'arrivée dans l\'équipe";"Date de départ de l\'équipe"',
      `"Test";${userList[2]._id};"Olait";"Auxiliary";"10/12/2022";`,
      `"Test";${userList[4]._id};"Test";"PlanningReferent";"10/12/2022";`,
      `"Etoile";${auxiliaryList[0]._id};"Uiui";"Lulu";"10/12/2018";`,
    ],
  },
  {
    exportType: RUP,
    expectedRows: [
      '\ufeff"Id Auxiliaire";"Nom";"Prénom";"Civilité";"Date de naissance";"Nationalité";"Emploi";"Type de contrat";"Date de début";"Date de fin"',
      `${auxiliaryList[0]._id.toHexString()};"UIUI";"Lulu";"M.";"01/01/1992";"Française";"Auxiliaire de vie";"CDI";"01/01/2018";"01/01/2020"`,
      `${auxiliaryList[0]._id.toHexString()};"UIUI";"Lulu";"M.";"01/01/1992";"Française";"Auxiliaire de vie";"CDI";"01/02/2020";`,
      `${auxiliaryList[1]._id.toHexString()};"LOLO";"Lili";"M.";"01/01/1992";"Française";"Auxiliaire de vie";"CDI";"01/02/2020";`,
    ],
  },
  {
    exportType: REFERENT,
    expectedRows: [
      '\ufeff"Id Bénéficiaire";"Bénéficiaire - Titre";"Bénéficiaire - Nom";"Bénéficiaire - Prénom";"Id Auxiliaire";"Auxiliaire - Titre";"Auxiliaire - Nom";"Auxiliaire - Prénom";"Date de début";"Date de fin"',
      `${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";${auxiliaryList[0]._id.toHexString()};"M.";"UIUI";"Lulu";"31/01/2020";`,
      `${customersList[0]._id.toHexString()};"M.";"FROOME";"Christopher";${auxiliaryList[1]._id.toHexString()};"M.";"LOLO";"Lili";"12/03/2019";"30/01/2020"`,
      `${customersList[1]._id.toHexString()};"M.";"BERNAL";"Egan";${auxiliaryList[0]._id.toHexString()};"M.";"UIUI";"Lulu";"23/06/2019";`,
    ],
  },
];

dataExportTypes.forEach(({ exportType, expectedRows }) => {
  describe(`GET /exports/${exportType}/data`, () => {
    let authToken;
    before(populateDB);

    describe('COACH', () => {
      beforeEach(async () => {
        authToken = await getToken('coach');
      });

      it(`should get ${exportType}`, async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/exports/${exportType}/data`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(200);

        const rows = response.result.split('\r\n');
        expect(rows.length).toBe(expectedRows.length);

        for (let i = 0; i < expectedRows.length; i++) expect(rows.some(r => r === expectedRows[i])).toBeTruthy();
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'planning_referent', expectedCode: 403 },
        { name: 'vendor_admin', expectedCode: 403 },
        { name: 'client_admin', expectedCode: 403, erp: false },
      ];
      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
          authToken = await getToken(role.name, role.erp);
          const response = await app.inject({
            method: 'GET',
            url: `/exports/${exportType}/data`,
            headers: { Cookie: `alenvi_token=${authToken}` },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });
});
