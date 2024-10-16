module.exports = {
  language: 'fr-FR',
  'en-EN': {
    /* Token errors */
    tokenExpired: 'Token is expired.',
    /* Users strings */
    usersNotFound: 'There are no users.',
    userNotFound: 'User doesn\'t exist.',
    userEmailExists: 'This email is already taken by another user.',
    userFound: 'User found successfully.',
    userSaved: 'User saved successfully.',
    userRemoved: 'User removed successfully.',
    userUpdated: 'User updated successfully.',
    userAuthentified: 'User authenticated successfully.',
    userLogout: 'User disconnected successfully.',
    userRoleConflict: 'User already has a role on this interface.',
    userDeletionForbidden: 'You can not delete your account if it is linked to a company.',
    /* Api */
    apiVersionUpToDate: 'api version up to date.',
    apiVersionToUpdate: 'api version must be updated.',
    /* SMS */
    smsSent: 'SMS well sent.',
    smsFound: 'SMS found.',
    /* Role */
    rolesNotFound: 'Roles not found.',
    rolesFound: 'Roles found.',
    unknownRole: 'Role does not exist.',
    /* Email */
    emailSent: 'Email successfully sent.',
    emailNotSent: 'An error occurred while sending the email.',
    /* Reset password token */
    resetPasswordTokenFound: 'Reset password token found.',
    /* Uploader */
    fileCreated: 'File successfully created.',
    /* Company */
    companyCreated: 'Company created.',
    companiesFound: 'Companies found.',
    companyFound: 'Company found.',
    companyNotFound: 'Company not found.',
    companyExists: 'Company already exists.',
    holdingCreated: 'Holding created.',
    holdingExists: 'Holding already exists.',
    holdingsFound: 'Holding(s) found.',
    holdingUpdated: 'Holding updated.',
    userCompanyNotLinkedToHolding: 'Company not linked to holding.',
    userAlreadyLinkedToHolding: 'User already linked to holding.',
    companyLinkRequestCreated: 'Company link request created.',
    companyLinkRequestsFound: 'Company link requests found.',
    companyLinkRequestDeleted: 'Company link request deleted.',
    /* Bills */
    billsCreated: 'Bills created.',
    billCreated: 'Bill created.',
    billsFound: 'Bills found.',
    periodMustBeLessThanOneYear: 'Period must be less than a year.',
    /* Credit Notes */
    creditNotesFound: 'Credit notes found.',
    creditNoteCreated: 'Credit note found.',
    creditNoteDeleted: 'Credit note deleted.',
    creditNoteNotFound: 'Credit note not found.',
    creditNoteNotCompani: 'Credit note\'s origin must be \'Compani\'.',
    /* Balances */
    balancesFound: 'Balances found.',
    /* Payments */
    paymentNotFound: 'Payment not found.',
    paymentCreated: 'Payment created.',
    paymentUpdated: 'Payment updated.',
    paymentRemoved: 'Payment removed.',
    /* Programs */
    programsFound: 'Programs found.',
    programsNotFound: 'Programs not found.',
    programCreated: 'Program created.',
    programFound: 'Program found.',
    programUpdated: 'Program updated.',
    testerAdded: 'Tester added to program.',
    testerRemoved: 'Tester removed from program.',
    testerNotFound: 'Tester not found in program.',
    testerConflict: 'Tester already added to program.',
    /* Categories */
    categoriesFound: 'Categories found.',
    categoriesNotFound: 'Categories not found.',
    categoryCreated: 'Category created.',
    categoryUpdated: 'Category updated.',
    categoryDeleted: 'Category deleted.',
    categoryAdded: 'Category added.',
    categoryRemoved: 'Category removed.',
    /* SubPrograms */
    subProgramsFound: 'Sub-programs found.',
    subProgramFound: 'Sub-program found.',
    subProgramsNotFound: 'Sub-programs not found.',
    subProgramUpdated: 'Sub-program updated.',
    eLearningSubProgramAlreadyExists: 'A published eLearning sub-program already exists.',
    /* Steps */
    stepUpdated: 'Step updated.',
    stepsFound: 'Steps found.',
    /* Activities */
    activityFound: 'Activity found.',
    activityUpdated: 'Activity updated.',
    activityDetached: 'Activity detached.',
    /* Cards */
    cardUpdated: 'Card updated.',
    cardDeleted: 'Card deleted.',
    /* Courses */
    coursesFound: 'Courses found.',
    courseHistoriesFound: 'Course histories found.',
    coursesNotFound: 'Courses not found.',
    courseHistoriesNotFound: 'Course histories not found.',
    courseCreated: 'Course created.',
    courseFound: 'Course found.',
    courseUpdated: 'Course updated.',
    courseDeleted: 'Course deleted.',
    courseDeletionForbidden: {
      trainees: 'Deletion forbidden : trainees are added',
      slots: 'Deletion forbidden : slots are added',
      billed: 'Deletion forbidden : course is billed',
      attendanceSheets: 'Deletion forbidden : course has attendance sheets',
    },
    courseTraineeAdded: 'Course trainee added.',
    courseCompanyAdded: 'Course company added.',
    courseTrainerAdded: 'Course trainer added.',
    courseTrainerRemoved: 'Course trainer removed.',
    courseTraineeRemoved: 'Course trainee removed.',
    courseCompanyRemoved: 'Course company removed.',
    companyTraineeRegisteredToCourse: 'Company trainee registered to course.',
    companyTraineeAttendedToCourse: 'Company trainee attended to course.',
    companyHasAttendanceSheetForCourse: 'Company has attendance sheet for course.',
    companyHasCourseBill: 'Company has a bill for this course.',
    courseTraineeAlreadyExists: 'Course trainee already added to course.',
    courseCompanyAlreadyExists: 'Course company already added to course.',
    courseTrainerAlreadyAdded: 'Course trainer already added to course.',
    courseTrainerIsTrainee: 'Course trainer is trainee.',
    maxTraineesReached: 'Max. number of trainees reached for this course.',
    maxTraineesSmallerThanRegistered: 'Max. number of trainees can\'t be smaller than actual registered number.',
    courseTraineeNotFromCourseCompany: 'Course trainee not connected to course company.',
    courseAccessRuleAdded: 'Access rule added.',
    courseAccessRuleDeleted: 'Access rule deleted.',
    courseQuestionnairesFound: 'Questionnaires found.',
    courseAttendanceNotGenerated: 'Failed to download attendance sheet, no on-site slot.',
    traineeMustBeRegisteredInAnotherGroup: 'Trainee must be registered in another group.',
    /* Course bill */
    courseBillsFound: 'Course bills found.',
    courseBillsNotFound: 'Course bills not found.',
    courseBillCreated: 'Course bill created.',
    courseBillUpdated: 'Course bill updated.',
    courseBillingItemAlreadyAdded: 'Course billing item already added to bill.',
    courseCompanyAddressMissing: 'Course company address missing.',
    /* Course billing items */
    courseBillingItemExists: 'Course billing item exists.',
    courseBillingItemsFound: 'Course billing items found.',
    courseBillingItemsNotFound: 'Course billing items not found.',
    courseBillingItemCreated: 'Course billing item created.',
    /* Course slots */
    courseSlotCreated: 'Course slot created.',
    courseSlotUpdated: 'Course slot updated.',
    courseSlotDeleted: 'Course slot deleted.',
    courseSlotNotFound: 'Course slot not found.',
    courseSlotConflict: 'Course slot in conflict.',
    courseSlotWithAttendances: 'Course slot has attendances.',
    courseSlotsAlreadyInAttendanceSheet: 'Course slots already in attendance sheet.',
    /* Course funding organisation */
    courseFundingOrganisationsFound: 'Course funding organisations found.',
    courseFundingOrganisationsNotFound: 'Course funding organisations not found.',
    courseFundingOrganisationCreated: 'Course funding organisation created.',
    courseFundingOrganisationExists: 'Course funding organisation already exists.',
    courseFundingOrganisationDeleted: 'Course funding organisation deleted.',
    /* Activities */
    activityHistoryCreated: 'Activity history created.',
    activityHistoriesFound: 'Activity histories found.',
    /* AttendanceSheets */
    attendanceSheetCreated: 'AttendanceSheet created.',
    attendanceSheetUpdated: 'AttendanceSheet updated.',
    attendanceSheetsFound: 'AttendanceSheets found.',
    attendanceSheetsNotFound: 'AttendanceSheets not found.',
    attendanceSheetDeleted: 'AttendanceSheet deleted.',
    /* Attendances */
    attendanceCreated: 'Attendance created.',
    attendancesFound: 'Attendances found.',
    attendancesNotFound: 'Attendances not found.',
    attendanceDeleted: 'Attendance deleted.',
    attendanceExists: 'An attendance exists.',
    /* Questionnaires */
    questionnairesFound: 'Questionnaires found.',
    questionnairesNotFound: 'Questionnaires not found.',
    questionnaireCreated: 'Questionnaire created.',
    questionnaireFound: 'Questionnaire found.',
    draftQuestionnaireAlreadyExists: 'A draft questionnaire with this type already exists.',
    publishedQuestionnaireWithSameTypeExists: 'A questionnaire with the same type is already published.',
    questionnaireUpdated: 'questionnaire updated.',
    questionnaireHistoryCreated: 'Questionnaire history created.',
    questionnaireHistoryUpdated: 'Questionnaire history updated.',
    questionnaireQRCodeGenerated: 'Questionnaire QR Code generated.',
    /*  QuestionnaireHistories */
    questionnaireHistoryConflict: 'A questionnaire history already exists.',
    /* userCompanies */
    userCompanyNotFound: 'User company doesn\'t exist.',
    userCompanyUpdated: 'User company updated.',
    userCompanyCreated: 'User company created.',
    userDetachmentBeforeLastSubscription: `You can't detach the user before {DATE}, the user is subscribed to a course
      with this company.`,
    userCompanyDetachmentBeforeAttachment: 'You can\'t detach the user company before its attachment.',
    /* VendorCompanies */
    vendorCompanyFound: 'Vendor company found.',
    vendorCompanyUpdated: 'Vendor company updated.',
    /* VendorCompanies */
    userAlreadyLinkedToCompany: 'User already linked to company.',
    userAlreadyLinkedToCompanyUntil: 'User already linked to company until {DATE}.',
    /* TrainingContracts */
    trainingContractCreated: 'Training contract created',
    trainingContractsFound: 'Training contracts found',
    trainingContractsNotFound: 'Training contracts not found',
    trainingContractDeleted: 'Training contract deleted',
    trainingContractAlreadyExists: 'Training contract already exists for this course and company.',
    /* TrainerMissions */
    trainerMissionCreated: 'Trainer mission created',
    trainerMissionAlreadyExist: 'Trainer mission already exists.',
    trainerMissionsFound: 'Trainer missions found',
    trainerMissionsNotFound: 'Trainer missions not found',
    trainerMissionUpdated: 'Trainer mission updated',
  },
  'fr-FR': {
    /* Token errors */
    tokenExpired: 'Le token a expiré.',
    /* Users strings */
    usersNotFound: 'Il n\'y a aucun compte.',
    userNotFound: 'Le compte n\'existe pas.',
    userEmailExists: 'Cet email est déjà pris par un autre compte.',
    userSaved: 'Compte enregistré avec succès.',
    userFound: 'Compte trouvé avec succès.',
    userRemoved: 'Compte supprimé avec succès.',
    userUpdated: 'Compte modifié avec succès.',
    userAuthentified: 'Compte authentifié avec succès.',
    userLogout: 'Compte déconnecté avec succès.',
    userRoleConflict: 'Ce compte a déjà un rôle sur cette interface.',
    userDeletionForbidden: 'Vous ne pouvez pas supprimer votre compte s\'il est rattaché à une structure.',
    /* Api */
    apiVersionUpToDate: 'La version de l\'api est à jour.',
    apiVersionToUpdate: 'La version de l\'api doit être mis à jour.',
    /* SMS */
    smsSent: 'SMS bien envoyé.',
    smsFound: 'SMS trouvés.',
    /* Role */
    rolesNotFound: 'Rôles non trouvés.',
    rolesFound: 'Rôles trouvés.',
    unknownRole: 'Le rôle n\'existe pas.',
    /* Email */
    emailSent: 'Email envoyé avec succès.',
    emailNotSent: 'Erreur lors de l\'envoi de l\'email.',
    /* Reset password token */
    resetPasswordTokenFound: 'Token de changement de password trouvé.',
    /* Uploader */
    fileCreated: 'Fichier créé.',
    /* Company */
    companyCreated: 'Entreprise créée.',
    companiesFound: 'Entreprises trouvées.',
    companyFound: 'Entreprise trouvée.',
    companyNotFound: 'Entreprise non trouvée.',
    companyExists: 'Entreprise déjà existante.',
    holdingCreated: 'Société mère créée.',
    holdingExists: 'Société mère déjà existante.',
    holdingsFound: 'Société(s) mère(s) trouvée(s).',
    holdingUpdated: 'Société mère mise à jour.',
    userCompanyNotLinkedToHolding: 'La structure de la personne n\'est pas rattachée à la société mère.',
    userAlreadyLinkedToHolding: 'La personne est déjà rattachée à une société mère.',
    companyLinkRequestCreated: 'Demande de rattachement à une structure créée.',
    companyLinkRequestsFound: 'Demandes de rattachement à la structure trouvées.',
    companyLinkRequestDeleted: 'Demande de rattachement à la structure supprimée.',
    /* Bills */
    billsCreated: 'Factures créées.',
    billCreated: 'Facture créée.',
    billsFound: 'Factures trouvés.',
    periodMustBeLessThanOneYear: 'La période maximale est 1 an.',
    /* Credit Notes */
    creditNotesFound: 'Avoirs trouvés.',
    creditNoteCreated: 'Avoir créé.',
    creditNoteDeleted: 'Avoir supprimé.',
    creditNoteNotFound: 'Avoir non trouvé.',
    creditNoteNotCompani: 'L\'origine de l\'avoir doit être \'Compani\'.',
    /* Balances */
    balancesFound: 'Balances trouvées.',
    /* Payments */
    paymentCreated: 'Règlement créé.',
    paymentNotFound: 'Règlement non trouvé.',
    paymentUpdated: 'Règlement modifié.',
    paymentRemoved: 'Règlement supprimé.',
    /* Programs */
    programsFound: 'Liste des programmes trouvée.',
    programsNotFound: 'Liste des programmes non trouvée.',
    programCreated: 'Programme créé.',
    programFound: 'Programme trouvé.',
    programUpdated: 'Programme mis à jour.',
    testerAdded: 'Testeur(euse) ajouté(e) au programme.',
    testerRemoved: 'Testeur(euse) supprimé(e) du programme.',
    testerNotFound: 'Testeur(euse) non trouvé(e) dans le programme.',
    testerConflict: 'Testeur(euse) déjà ajouté(e) au programme.',
    /* Categories */
    categoriesFound: 'Catégories trouvées.',
    categoriesNotFound: 'Catégories non trouvées.',
    categoryCreated: 'Catégorie créée.',
    categoryUpdated: 'Catégorie mise à jour.',
    categoryDeleted: 'Catégorie supprimée.',
    categoryAdded: 'Catégorie ajoutée.',
    categoryRemoved: 'Catégorie retirée.',
    /* SubPrograms */
    subProgramUpdated: 'Sous-Programme mis à jour.',
    subProgramsFound: 'Sous-Programmes trouvés.',
    subProgramFound: 'Sous-Programme trouvé.',
    subProgramsNotFound: 'Sous-Programmes non trouvés.',
    eLearningSubProgramAlreadyExists: 'Un sous-programme eLearning publié existe déjà.',
    /* Steps */
    stepsFound: 'Liste des étapes trouvée.',
    stepUpdated: 'Étape mise à jour.',
    /* Activities */
    activityFound: 'Activité trouvée.',
    activityUpdated: 'Activité mise à jour.',
    activityDetached: 'Activité retirée.',
    /* Cards */
    cardUpdated: 'Carte mise à jour.',
    cardDeleted: 'Carte supprimée.',
    /* Courses */
    coursesFound: 'Liste des formations trouvée.',
    courseHistoriesFound: 'Liste des historiques de formation trouvée.',
    coursesNotFound: 'Liste des formations non trouvée.',
    courseHistoriesNotFound: 'Liste des historiques de formation non trouvée.',
    courseCreated: 'Formation créée.',
    courseFound: 'Formation trouvée.',
    courseUpdated: 'Formation mise à jour.',
    courseDeleted: 'Formation supprimée.',
    courseDeletionForbidden: {
      trainees: 'Suppression impossible : des apprenants sont inscrits',
      slots: 'Suppression impossible : des créneaux sont rattachés',
      billed: 'Suppression impossible : la formation a une facture',
      attendanceSheets: 'Suppression impossible : la formation a au moins une feuille d\'émargement',
    },
    courseTraineeAdded: 'Stagiaire ajouté(e) à la formation.',
    courseCompanyAdded: 'Structure rattachée à la formation.',
    courseTrainerAdded: 'Intervenant(e) rattaché(e) à la formation.',
    courseTrainerRemoved: 'Intervenant(e) détaché(e) de la formation.',
    courseTraineeRemoved: 'Stagiaire supprimé(e) de la formation.',
    courseCompanyRemoved: 'Structure détachée de la formation.',
    companyTraineeRegisteredToCourse: 'Un(e) apprenant(e) de la structure est inscrit(e) à la formation.',
    companyTraineeAttendedToCourse: 'Un(e) apprenant(e) de la structure a émargé à la formation.',
    companyHasAttendanceSheetForCourse: 'Il existe une feuille d\'émargement rattachée à cette structure.',
    companyHasCourseBill: 'La structure a été facturée pour cette formation.',
    courseTraineeAlreadyExists: 'Stagiaire déjà ajouté(e) à la formation.',
    courseCompanyAlreadyExists: 'Structure déjà rattachée à la formation.',
    courseTrainerAlreadyAdded: 'Intervenant(e) déjà ajouté(e) à la formation.',
    courseTrainerIsTrainee: 'Ajout impossible : l\'intervenant·e sélectionné·e est apprenant.e de la formation.',
    maxTraineesReached: 'Nombre max. de stagiaires atteint pour cette formation.',
    maxTraineesSmallerThanRegistered: 'Le nombre max. de stagiaires ne peut être inférieur au nombre déjà inscrit.',
    courseTraineeNotFromCourseCompany: 'Ce compte n\'est pas relié à la structure de la formation.',
    courseAccessRuleAdded: 'Règle d\'accès ajoutée.',
    courseAccessRuleDeleted: 'Règle d\'accès supprimée.',
    courseQuestionnairesFound: 'Questionnaires trouvés.',
    courseAttendanceNotGenerated: 'Erreur lors du téléchargement, la formation ne contient pas de créneau présentiel.',
    traineeMustBeRegisteredInAnotherGroup: 'L\'apprenant doit être inscrit dans un autre groupe de cette formation.',
    /* Course bill */
    courseBillsFound: 'Factures de la formation trouvées.',
    courseBillsNotFound: 'Factures de la formation non trouvées.',
    courseBillCreated: 'Facture de la formation créée.',
    courseBillUpdated: 'Facture de la formation mise à jour.',
    courseBillingItemAlreadyAdded: 'Article déjà ajouté à la facture.',
    courseCompanyAddressMissing: 'L\'adresse de la structure cliente est manquante.',
    /* Course billing items */
    courseBillingItemExists: 'Article de facturation existant.',
    courseBillingItemsFound: 'Articles de facturation trouvés.',
    courseBillingItemsNotFound: 'Articles de facturation non trouvés.',
    courseBillingItemCreated: 'Article de facturation créé.',
    /* Course slots */
    courseSlotCreated: 'Créneau de formation créé.',
    courseSlotUpdated: 'Créneau de formation mis à jour.',
    courseSlotDeleted: 'Créneau de formation supprimé.',
    courseSlotNotFound: 'Créneau de formation non trouvé.',
    courseSlotConflict: 'Créneau de formation en conflit.',
    courseSlotWithAttendances: 'Impossible: ce créneau de formation est émargé.',
    courseSlotsAlreadyInAttendanceSheet: 'Certains créneaux sont déjà rattachés à une feuille d’émargement.',
    /* Course funding organisation */
    courseFundingOrganisationsFound: 'Financeurs trouvés.',
    courseFundingOrganisationsNotFound: 'Financeurs non trouvés.',
    courseFundingOrganisationCreated: 'Financeur créé.',
    courseFundingOrganisationExists: 'Financeur déjà existant.',
    courseFundingOrganisationDeleted: 'Financeur supprimé.',
    /* Activities */
    activityHistoryCreated: 'Historique d\'activité créé.',
    activityHistoriesFound: 'Historiques d\'activité trouvés.',
    /* AttendanceSheets */
    attendanceSheetCreated: 'Feuille d\'émargement créée.',
    attendanceSheetUpdated: 'Feuille d\'émargement modifiée.',
    attendanceSheetsFound: 'Feuilles d\'émargement trouvées.',
    attendanceSheetsNotFound: 'Feuilles d\'émargement non trouvées.',
    attendanceSheetDeleted: 'Feuille d\'émargement supprimée.',
    /* Attendances */
    attendanceCreated: 'Émargement créé.',
    attendancesFound: 'Émargements trouvés.',
    attendancesNotFound: 'Émargements non trouvés.',
    attendanceDeleted: 'Émargement supprimé.',
    attendanceExists: 'Un émargement existe.',
    /* Questionnaires */
    questionnairesFound: 'Liste des questionnaires trouvée.',
    questionnairesNotFound: 'Liste des questionnaires non trouvée.',
    questionnaireCreated: 'Questionnaire créé.',
    questionnaireFound: 'Questionnaire trouvé.',
    draftQuestionnaireAlreadyExists: 'Il existe déjà un questionnaire de ce type en brouillon.',
    publishedQuestionnaireWithSameTypeExists: 'Un questionnaire du même type est déjà publié.',
    questionnaireUpdated: 'Questionnaire mis à jour.',
    questionnaireHistoryCreated: 'Historique de questionnaire créé.',
    questionnaireHistoryUpdated: 'Historique de questionnaire mis à jour.',
    questionnaireQRCodeGenerated: 'QR Code généré.',
    /*  QuestionnaireHistories */
    questionnaireHistoryConflict: 'Vous avez déjà répondu à ce questionnaire.',
    /* UserCompanies */
    userCompanyNotFound: 'Impossible de mettre à jour les informations liées à la structure de cet(te) apprenant(e).',
    userCompanyUpdated: 'Informations sur la structure de l\'apprenant(e) mises à jour.',
    userCompanyCreated: 'Utilisateur rattaché à une structure.',
    userDetachmentBeforeLastSubscription: 'Vous ne pouvez pas détacher cette personne avant le {DATE}.',
    userCompanyDetachmentBeforeAttachment: 'La date de détachement de l\'utilisateur ne peut être antérieure à son '
      + 'rattachement.',
    /* VendorCompanies */
    vendorCompanyFound: 'Structure vendeuse trouvée.',
    vendorCompanyUpdated: 'Structure vendeuse mise à jour.',
    /* VendorCompanies */
    userAlreadyLinkedToCompany: 'Ce compte est déjà rattaché à une structure.',
    userAlreadyLinkedToCompanyUntil: 'Ce compte est déjà rattaché à une structure jusqu\'au {DATE}.',
    /* TrainingContracts */
    trainingContractCreated: 'Convention de formation créée',
    trainingContractsFound: 'Conventions de formation trouvées',
    trainingContractsNotFound: 'Conventions de formation non trouvées',
    trainingContractDeleted: 'Convention de formation supprimée',
    trainingContractAlreadyExists: 'Une convention associée à cette formation existe déjà pour cette '
      + 'structure.',
    /* TrainerMissions */
    trainerMissionCreated: 'Ordre de mission créé',
    trainerMissionAlreadyExist: 'Il existe déjà un ordre de mission pour une des formations.',
    trainerMissionsFound: 'Ordres de mission trouvés',
    trainerMissionsNotFound: 'Ordres de mission non trouvés',
    trainerMissionUpdated: 'Ordre de mission mis à jour',
  },
};
