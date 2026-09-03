pub struct PartnerSpec {
    pub trade_name: &'static str,
    pub legal_name: &'static str,
    pub category: &'static str,
    pub city: &'static str,
    pub department: &'static str,
}

pub const EMPLOYERS: [(&str, &str); 2] = [
    ("Ministère de la Transition écologique", "SIRET-40218733100019"),
    ("Agence régionale de santé Occitanie", "SIRET-13002526500013"),
];

pub const PARTNERS: [PartnerSpec; 12] = [
    PartnerSpec { trade_name: "Le Comptoir de Belleville", legal_name: "SARL Comptoir Belleville", category: "restaurant", city: "Paris", department: "Paris" },
    PartnerSpec { trade_name: "Boulangerie Ferrand", legal_name: "Ferrand et Fils SARL", category: "boulangerie", city: "Paris", department: "Paris" },
    PartnerSpec { trade_name: "Librairie du Canal", legal_name: "SAS Editions du Canal", category: "librairie", city: "Paris", department: "Paris" },
    PartnerSpec { trade_name: "Pharmacie Saint-Maur", legal_name: "SELARL Saint-Maur Santé", category: "pharmacie", city: "Paris", department: "Paris" },
    PartnerSpec { trade_name: "Chez Mireille", legal_name: "SARL Mireille Restauration", category: "restaurant", city: "Toulouse", department: "Haute-Garonne" },
    PartnerSpec { trade_name: "Le Fournil des Minimes", legal_name: "SARL Fournil des Minimes", category: "boulangerie", city: "Toulouse", department: "Haute-Garonne" },
    PartnerSpec { trade_name: "Supermarché Ombrière", legal_name: "SAS Distribution Ombrière", category: "supermarché", city: "Toulouse", department: "Haute-Garonne" },
    PartnerSpec { trade_name: "Pharmacie de Blagnac Centre", legal_name: "SELARL Blagnac Centre", category: "pharmacie", city: "Blagnac", department: "Haute-Garonne" },
    PartnerSpec { trade_name: "La Table de Tulle", legal_name: "SARL Table de Tulle", category: "restaurant", city: "Tulle", department: "Corrèze" },
    PartnerSpec { trade_name: "Librairie Preneuf", legal_name: "SARL Preneuf Livres", category: "librairie", city: "Tulle", department: "Corrèze" },
    PartnerSpec { trade_name: "Marché Couvert Brive", legal_name: "SAS Halles de Brive", category: "supermarché", city: "Brive-la-Gaillarde", department: "Corrèze" },
    PartnerSpec { trade_name: "Boulangerie Lachaud", legal_name: "Lachaud SARL", category: "boulangerie", city: "Brive-la-Gaillarde", department: "Corrèze" },
];

pub const EMPLOYEES: [(&str, &str); 50] = [
    ("Amina", "Cissé"), ("Thomas", "Berger"), ("Claire", "Martin"), ("Youssef", "Benali"),
    ("Élodie", "Rousseau"), ("Marc", "Lefèvre"), ("Nadia", "Bouchard"), ("Julien", "Faure"),
    ("Sophie", "Marchand"), ("Karim", "Haddad"), ("Léa", "Dumas"), ("Antoine", "Perrin"),
    ("Fatou", "Diallo"), ("Guillaume", "Noël"), ("Camille", "Robin"), ("Hugo", "Barbier"),
    ("Inès", "Chevalier"), ("Mathieu", "Colin"), ("Sarah", "Leroy"), ("Pierre", "Guillot"),
    ("Awa", "Traoré"), ("Nicolas", "Renard"), ("Manon", "Lemoine"), ("Samuel", "Aubert"),
    ("Chloé", "Fontaine"), ("Adrien", "Roussel"), ("Lucie", "Charpentier"), ("Malik", "Ould"),
    ("Emma", "Girard"), ("Vincent", "Pichon"), ("Salima", "Meziane"), ("Baptiste", "Royer"),
    ("Céline", "Weber"), ("Olivier", "Maillard"), ("Rachida", "Amrani"), ("Damien", "Sauvage"),
    ("Aurélie", "Bonnet"), ("Étienne", "Delaunay"), ("Nour", "Zerrouki"), ("Romain", "Gauthier"),
    ("Isabelle", "Carpentier"), ("Franck", "Millet"), ("Zoé", "Devaux"), ("Sébastien", "Hamon"),
    ("Maryse", "Lucas", ), ("Alexandre", "Poirier"), ("Djamila", "Saïdi"), ("Benoît", "Chartier"),
    ("Laure", "Vasseur"), ("Cédric", "Moulin"),
];
