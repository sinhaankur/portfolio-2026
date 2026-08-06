// Publications of Dr. Randhir Kumar Sinha — Scientist-D (Joint Director, retd.),
// Central Silk Board, Ministry of Textiles, Govt. of India.
//
// Transcribed from his own curriculum vitae (career 1975–2008). Grouped by year.
// This is a living reference archive — entries may be corrected or added over
// time. Research papers, conference/seminar papers, popular articles, and
// books/catalogues are each kept in their own list below.
//
// © The work is Dr. Randhir Kumar Sinha's; this is a faithful digital record of it.

export type Publication = {
  /** Full citation, as it appears in the source journal/proceedings. */
  citation: string
  /** Publication year (for grouping). */
  year: number
  /** Optional link to the paper online (DOI / publisher / repository), where
   *  one has been verified. Most of his work predates DOIs or lives in Indian
   *  journals that never went online — which is exactly why this archive exists. */
  url?: string
}

/** Career totals, from the CV's own summary table. */
export const randhirStats = {
  yearsOfService: 34,
  researchPapers: 60, // 45 national + 15 international
  popularArticles: 27, // 24 national + 3 international
  conferencePapers: 21, // distinct papers transcribed with full citations (CV summary lists 22)
  institutePublications: 16,
  booksAndCatalogues: 8,
  mscScholarsGuided: 3,
  mulberryAccessions: 1125,
  silkwormAccessions: 450,
} as const

/** Peer-reviewed research papers, newest groups first. */
export const researchPapers: Publication[] = [
  // 2008
  { year: 2008, citation: "Velu D., Ponnuvel K. M., Muthulakshmi M., Sinha R. K. and Qadri S. M. H. (2008). Analysis of genetic relationship in mutant silkworm strains of Bombyx mori using Inter Simple Sequence Repeat (ISSR) markers. Journal of Genetics and Genomics 35(5): 291–297.", url: "https://doi.org/10.1016/S1673-8527(08)60042-9" },
  { year: 2008, citation: "Koundinya P. R., Ponnuvel K. M., Sinha R. K. and Kamble C. K. (2008). Bacterial induced immunity studies in selected silkworm (Bombyx mori) germplasm races. Indian Journal of Sericulture 47(1): 122–125." },
  { year: 2008, citation: "Koshy N., Ponnuvel K. M., Sinha R. K. and Qadri S. M. H. (2008). Silkworm Nucleotide Databases — Current Trends and Future Prospects. Bioinformation 2(7): 308–310." },
  { year: 2008, citation: "Koundinya P. R., Hiremath S. A., Sinha R. K., Babu G. K., Balchandran N. (2008). Studies on silk reeling and fibre quality traits of bivoltine silkworm (Bombyx mori L.) germplasm breeds and selection of elite genotypes. Geobios." },
  { year: 2008, citation: "Raghunathan Saravanakumar, Ponnuvel K. M., Velu D., Koundinya P. R., Sinha R. K. and Qadri S. M. H. (2008). Identification of diapause and non-diapause associated proteins in the eggs of multivoltine silkworm Bombyx mori by MALDI MS analysis. International Journal of Industrial Entomology 16(2): 37–48." },
  { year: 2008, citation: "Ponnuvel K. M., Ashok Kumar K., Somasundaram P., Sinha R. K., Kamble C. K. (2008). Genomic organization of esterase gene in Bombyx mori. Indian Journal of Biotechnology 7: 183–187." },
  { year: 2008, citation: "Ponnuvel K. M., Koundinya P. R., Sinha R. K. and Kamble C. K. (2008). Mechanism of viral resistance in mulberry silkworm, Bombyx mori L. Indian Journal of Sericulture (Mysore) 47(1): 1–6." },
  // 2007
  { year: 2007, citation: "Kumaresan P., Koundinya P. R., Hiremath S. A. and Sinha R. K. (2007). An analysis of genetic variation and divergence on silk fibre characteristics of multivoltine silkworm (Bombyx mori L.) genotypes. International Journal of Industrial Entomology 14(1): 23–32." },
  { year: 2007, citation: "Kumaresan P., Sinha R. K. and Raje Urs S. (2007). An analysis of genetic variation and divergence in Indian tropical polyvoltine silkworm (Bombyx mori L.) genotypes. Caspian Journal of Environmental Sciences 5(1): 45–55." },
  { year: 2007, citation: "Ponnuvel K. M., Mohana Sundari B., Saravana Kumar R., Sinha R. K., Kamble C. K. (2007). Identification of a putative RNAse III (dicer homolog) gene in silkworm Bombyx mori. Invertebrate Survival Journal (Italy) 4: 18–23." },
  { year: 2007, citation: "Ponnuvel K. M., Koundinya P. R., Ashok Kumar K., Sinha R. K. and Kamble C. K. (2007). Antiviral activity of digestive enzymes of silkworm Bombyx mori against nucleopolyhedrovirus — A review. Sericologia 47(3): 243–252." },
  // 2005
  { year: 2005, citation: "Kumaresan P., Sinha R. K. and Thangavelu K. (2005). Phenotypic stability and G × E interaction in cocoon weight of multivoltine silkworm (Bombyx mori L.) genotypes. Indian Journal of Sericulture 44(1): 136–138." },
  { year: 2005, citation: "Muthulakshmi M., Mohan B., Balachandran N., Sinha R. K. and Thangavelu K. (2005). Effect of extended egg preservation schedule in conservation of mutant silkworm (Bombyx mori L.) genetic stock in gene bank. International Journal of Industrial Entomology 11(2): 93–98." },
  { year: 2005, citation: "Kumaresan P., Sinha R. K. and Thangavelu K. (2005). Perspectives in silkworm (Bombyx mori L.) bio-diversity conservation. 20th Congress of the International Sericultural Commission, Bangalore, Vol. I, Section 2: 279–291." },
  // 2004
  { year: 2004, citation: "Kumaresan P., Sinha R. K., Mohan B. and Thangavelu K. (2004). Conservation of multivoltine silkworm (Bombyx mori L.) genotypes in India — An overview. International Journal of Industrial Entomology 9(1): 1–13." },
  { year: 2004, citation: "Kumaresan P., Thangavelu K. and Sinha R. K. (2004). Studies on long-term preservation of eggs of Indian tropical multivoltine silkworm (Bombyx mori L.) genetic resources. International Journal of Industrial Entomology 9(1): 79–87." },
  { year: 2004, citation: "Somasundram P., Krishnan M., Thangavelu K., Sinha R. K., Ashok Kumar K. and Kar P. K. (2004). Storage protein profiles in multivoltine silkworm breeds of Bombyx mori L. Entomon 29: 1–7." },
  { year: 2004, citation: "Kumaresan P., Mohan B., Mahadevamurthy T. S., Rayaraddar F. R., Kaundiniya P. R., Sinha R. K. and Thangavelu K. (2004). Specialised silkworm breeds (Bombyx mori L.) in silkworm germplasm stock of India. Indian Journal of Sericulture 43(2): 146–150." },
  { year: 2004, citation: "Somasundram P., Ashok Kumar K., Kar P. K., Thangavelu K. and Sinha R. K. (2004). Preliminary study on isozyme variation in silkworm germplasm of Bombyx mori L. and its implication for conservation. Malaysian Journal of Tropical Agricultural Science 27(2): 167–171." },
  // 2003
  { year: 2003, citation: "Koundinya P. R., Kumaresan P., Sinha R. K. and Thangavelu K. (2003). Screening of promising multivoltine silkworm (Bombyx mori L.) germplasm for thermo-tolerance. Indian Journal of Sericulture 42(1): 67–70." },
  { year: 2003, citation: "Kumaresan P., Sinha R. K. and Thangavelu K. (2003). Heterosis in some elite multivoltine silkworm (Bombyx mori L.) races with popular NB4D2. International Journal of Industrial Entomology 7(2): 93–106." },
  { year: 2003, citation: "Kumaresan P., Mahadevamurthy T. S., Thangavelu K. and Sinha R. K. (2003). Further studies on the genetic divergence of multivoltine silkworm (Bombyx mori L.) genotypes based on economic characters. Entomon 28(3): 193–198." },
  { year: 2003, citation: "Kumaresan P., Mohan B., Sinha R. K. and Thangavelu K. (2003). Selection of elite silkworm (Bombyx mori L.) germplasm through rank correlation analysis. Entomon 28(4): 283–291." },
  // 2002
  { year: 2002, citation: "Kumaresan P. and Sinha R. K. (2002). Genetic divergence in multivoltine silkworm (Bombyx mori L.) germplasm in relation to cocoon characters. Indian Journal of Genetics & Plant Breeding 62(2): 183–184." },
  { year: 2002, citation: "Kumaresan P., Radhakrishnan S. and Sinha R. K. (2002). Variability and correlation analysis for the nutritional indices in polyvoltine silkworm (Bombyx mori L.) germplasm. Indian Journal of Genetics 62(4): 377–379." },
  { year: 2002, citation: "Kumaresan P., Sinha R. K., Rayaraddar F. R. and Thangavelu K. (2002). Selection of parents from multivoltine silkworm (Bombyx mori L.) germplasm through principal component analysis. Indian Journal of Genetics & Plant Breeding 63(2): 189–190." },
  // 2001
  { year: 2001, citation: "Kumaresan P., Mukherjee S. and Sinha R. K. (2001). Variability in chiasma frequency of polyvoltine mulberry silkworm (Bombyx mori L.) races. Bulletin of the Indian Academy of Sericulture 5(1): 40–44." },
  { year: 2001, citation: "Kumaresan P., Radhakrishnan S. and Sinha R. K. (2001). Variability and correlation analysis on the nutritional indices of polyvoltine silkworm (Bombyx mori L.) germplasm stocks. Indian Journal of Genetics 62(4): 377–379." },
  // 2000
  { year: 2000, citation: "Mukherjee S., Mukherjee P., Dhahira Beevi N. and Sinha R. K. (2000). Genetic variability in cocoon shape, size and weight variables in multivoltine silkworm, Bombyx mori L. Indian Journal of Genetics 60(4): 541–546." },
  { year: 2000, citation: "Kumaresan P., Sinha R. K., Sahni N. K. and Sekar S. (2000). Genetic variability and selection indices for economic quantitative traits of multivoltine mulberry silkworm (Bombyx mori L.) genotypes. Sericologia 40(4): 595–605." },
  // 1999
  { year: 1999, citation: "Mukherjee S., Mukherjee P., Sahni N. K. and Sinha R. K. (1999). Characterisation and evaluation of Indian multivoltine silkworm (Bombyx mori) germplasm. Indian Journal of Agricultural Sciences 69(5): 36–70." },
  // 1997
  { year: 1997, citation: "Ponnuvel K. M., Harikumar A., Babu C. M. and Sinha R. K. (1997). Change in body weight, silk gland tissue somatic index and haemolymph properties of healthy and uzi-parasitized silkworm larvae of Antheraea proylei. Indian Journal of Wild Silkmoth & Silk 3: 75–78." },
  // 1996
  { year: 1996, citation: "Srivastava P. P., Kar P. K., Sinha R. K. and Thangavelu K. (1996). Variation in some constituents of cocoon shell in different eco-races of Antheraea mylitta Drury (Lepidoptera: Saturniidae). Bulletin of Sericultural Science 7: 87–89." },
  { year: 1996, citation: "Sinha R. K., Kar P. K., Srivastava P. P., Thangavelu K. (1996). Amino-transferase activity of Indian tasar silkworm, Antheraea mylitta Drury. Indian Journal of Sericulture 35(1): 24–27." },
  // 1995
  { year: 1995, citation: "Kar P. K., Srivastava P. P., Sinha R. K. and Thangavelu K. (1995). Impact of female pupa weight and haemolymph lipids on egg production in Indian tasar silkworm Antheraea mylitta Drury. Environment & Ecology 13(1): 84–88." },
  { year: 1995, citation: "Sinha R. K. and Sinha S. P. (1995). Effect of mutagens on chiasma frequency in Bombyx mori L. (Lepidoptera: Bombycidae). Journal of Cytology & Genetics 30(1): 91–94." },
  { year: 1995, citation: "Srivastava P. P., Kar P. K., Sinha R. K. and Thangavelu K. (1995). Citrate concentration in pupal haemolymph of different races and F1's of top cross of Antheraea mylitta Drury. Indian Journal of Physiology & Allied Sciences 49(3): 116–120." },
  // 1994
  { year: 1994, citation: "Sinha R. K., Sharma K. K., Sinha B. R. R. P. and Thangavelu K. (1994). Chiasma distribution and frequency in Antheraea mylitta Drury (Lepidoptera: Saturniidae). Proceedings of the National Academy of Sciences India 64(B II): 157–168." },
  { year: 1994, citation: "Srivastava P. P., Kar P. K., Sinha R. K. and Thangavelu K. (1994). Sequential extraction of cuticular compositions of Antheraea mylitta Drury. National Academy of Sciences Letters 17(7&8): 125–128." },
  { year: 1994, citation: "Sinha R. K., Srivastava P. P., Kar P. K. and Thangavelu K. (1994). Lipid concentration in the pupal haemolymph of different eco-races and F1's of top cross of Antheraea mylitta D. Geobios 21(3): 152–153." },
  { year: 1994, citation: "Kar P. K., Srivastava P. P., Sinha R. K. and Sinha B. R. R. P. (1994). Protein concentration in the pupal haemolymph of different eco-races and F1's of top cross of Antheraea mylitta D. Indian Journal of Sericulture 33(2): 174–175." },
  { year: 1994, citation: "Devaraj Y., Chalapathi, Sinha R. K. and Noamani M. K. R. (1994). Ovipositional behaviour and relation between body weight and fecundity in Antheraea proylei (Lepidoptera: Saturniidae). Journal of Sericulture 142(2): 33–44." },
  { year: 1994, citation: "Ajit Kumar Sinha, Sinha R. K., Goel A. K., Sinha B. R. R. P. and Thangavelu K. (1994). A review on the breeding and genetic aspects of tropical silkworm, Antheraea mylitta D. Proc. Conf. on Cytology & Genetics 4: 7–16." },
  // 1993
  { year: 1993, citation: "Kar P. K., Srivastava P. P., Dubey O. P., Sinha R. K. and Sinha B. R. R. P. (1993). Variation in the haemolymph quantum amongst different eco-races and F1's of top cross of Antheraea mylitta D. Geobios 20: 36–40." },
  { year: 1993, citation: "Srivastava P. P., Kar P. K., Sinha R. K. and Sinha B. R. R. P. (1993). Trehalose concentration in the pupal haemolymph of different eco-races and F1's of top cross of Antheraea mylitta D. (Lepidoptera: Saturniidae). Indian Journal of Physiology & Allied Sciences 47(3): 146–149." },
  { year: 1993, citation: "Sinha R. K. (1993). Sensitivity of male germ cells to mitomycin C for induction of dominant lethals in Bombyx mori L. Sericologia 33(2): 173–283." },
  { year: 1993, citation: "Sinha R. K., Kulshresta V. and Sinha S. P. (1993). Sensitivity of male germ cells to mutagens for induction of dominant lethals in silkworm Bombyx mori L. Journal of Cytology & Genetics 29(2): 85–91." },
  { year: 1993, citation: "Sinha R. K., Noamani M. K. R. and Sinha S. P. (1993). Sensitivity of different germ cells to X-radiation for induction of dominant lethals in mulberry silkworm, Bombyx mori L. Journal of Sericulture 1(2): 29–55." },
  { year: 1993, citation: "Sinha R. K., Sharma K. K., Bansal A. K., Sinha B. R. R. P. and Noamani M. K. R. (1993). Cytological investigation of various eco-races of Antheraea mylitta D. (Lepidoptera: Saturniidae). Journal of Sericulture 1(2): 59–62." },
  { year: 1993, citation: "Sinha R. K., Srivastava P. P., Kar P. K., Sinha B. R. R. P. and Thangavelu K. (1993). Lipid concentration in the cocoon shell of different races of Antheraea mylitta Drury (Lepidoptera: Saturniidae). Indian Journal of Sericulture 32(2): 218–219." },
  // 1987
  { year: 1987, citation: "Bahl R. K., Sinha R. K., Pandey R. K., Rao P. R. T., Tikoo B. L. and Sengupta K. (1987). Oak Tasar, Antheraea proylei J. rearing in Himachal (India). XVth International Sericulture Congress, Sericologia 27(3): 565–566." },
]

/** Papers presented at conferences, seminars and workshops. */
export const conferencePapers: Publication[] = [
  // 2008
  { year: 2008, citation: "Koundinya P. R., Ponnuvel K. M., Sinha R. K. and Qadri S. M. H. (2008). Screening of multivoltine silkworm genetic resources for gut alkaline protease activity. Proceedings of Recent Trends in Seri-Biotechnology, Anantapur University, March 2008." },
  { year: 2007, citation: "Ponnuvel K. M., Kar P. K., Sinha R. K. and Kamble C. K. (2007). Regulation of immune response against microbial pathogens in silkworm, Bombyx mori. Proceedings of short-term training course on recent trends in Seri-Biotechnology, 26 March 2007, TNAU, Coimbatore." },
  // 2006
  { year: 2006, citation: "Sinha R. K. and Raje Urs S. (2006). Present status, problems and prospects of Vanya silk as an economic enterprise in North-West India. Regional Seminar on Prospects and Problems of Sericulture as Economic Enterprise in North West India, 11–12 November 2006, Dehradun." },
  // 2005
  { year: 2005, citation: "Kumaresan P., Sinha R. K. and Thangavelu K. (2005). Perspectives in silkworm (Bombyx mori L.) bio-diversity conservation in India. 20th Congress of the International Sericultural Commission (Vol. 1), 15–18 December 2005, Bangalore: 279–291." },
  { year: 2005, citation: "Mohan B., Sinha R. K. and Thangavelu K. (2005). Silkworm breeding in India — future strategies for improvement. Brainstorming for Mulberry and Silkworm Breeders, 25–26 April 2005, CSGRC, Hosur." },
  { year: 2005, citation: "Mohan B., Sinha R. K. and Thangavelu K. (2005). Importance of silkworm germplasm and its potential use in silkworm breeding. 5th Breeders Meet, 14–15 February 2006, CSR&TI, Berhampore." },
  // 2004
  { year: 2004, citation: "Ashok Kumar K., Somasundram P., Kar P. K., Sinha R. K. and Thangavelu K. (2004). Biochemical characterisation of multivoltine silkworm resources through esterase isozyme polymorphism. National Level Seminar on Bio and Bio Sciences, 9–10 January 2004, Muthayammal College of Arts and Science, Rasipuram." },
  { year: 2004, citation: "Balachandran N., Mahadevamurthy T. S., Mohan B., Sinha R. K. and Thangavelu K. (2004). Estimation of evaluation indices for bivoltine silkworm genetic resources. National Symposium on Recent Trends in Applied Biology, 29–30 January 2004, Avinashilingam Deemed University, Coimbatore: 63." },
  { year: 2004, citation: "Mohan B., Mukherjee S., Muthulakshmi M., Sinha R. K. and Thangavelu K. (2004). Characterisation of silkworm genetic resources — an overview. National Symposium on Recent Trends in Applied Biology, 29–30 January 2004, Avinashilingam Deemed University, Coimbatore: 48." },
  { year: 2004, citation: "Muthulakshmi M., Mohan B., Balachandran N., Sinha R. K. and Thangavelu K. (2004). Disease management in silkworm germplasm conservation. National Symposium on Recent Trends in Applied Biology, 29–30 January 2004, Avinashilingam Deemed University, Coimbatore: 73." },
  { year: 2004, citation: "Somasundram P., Ashok Kumar K., Kar P. K., Sinha R. K. and Thangavelu K. (2004). Genetic diversity of haemolymph esterase in Bombyx mori L. silkworm races. National Symposium on Recent Trends in Bio Science, 27–28 February 2004, Sri Paramakalyani College, Alwarkurichi." },
  { year: 2004, citation: "Sinha R. K., Kar P. K. and Thangavelu K. (2004). Role of seri-genetic resources in cocoon crop improvement. National Workshop on Role of Seri-genetic Resources in Cocoon Crop Improvement, 23–24 November 2004, CSGRC, Hosur." },
  // 2003
  { year: 2003, citation: "Sinha R. K., Kumaresan P., Mohan B., Mahadevamurthy T. S. and Thangavelu K. (2003). Management and utilization of silkworm germplasm. National Workshop on Sericultural Germplasm Management and Utilisation, 6–7 February 2002, CSGRC, Hosur: 73–81." },
  { year: 2003, citation: "Sinha R. K., Kar P. K. and Thangavelu K. (2003). Pre-breeding strategies for utilization of silkworm genetic resources. Workshop on Pre-breeding Strategies for Utilization of Sericultural Germplasm Resources, 19–20 February 2003, CSGRC, Hosur." },
  { year: 2003, citation: "Mahadevamurthy T. S., Mohan B., Radhakrishnan S., Sinha R. K. and Thangavelu K. (2003). Effect of long-term cold preservation of bivoltine silkworm (Bombyx mori L.) germplasm. National Seminar on Silkworm Seed Production, 25–26 June 2003, SSTL, Bangalore: 21." },
  { year: 2003, citation: "Radhakrishnan S., Kumaresan P., Sinha R. K. and Thangavelu K. (2003). Induction of egg diapause in the eggs of multivoltine silkworm (Bombyx mori L.) germplasm for long-term preservation. National Seminar on Silkworm Seed Production, 25–26 June 2003, SSTL, Bangalore: 26." },
  { year: 2003, citation: "Thangavelu K., Sinha R. K. and Tikader A. (2003). Progress in sericultural germplasm resources and management. Souvenir, National Conference on Tropical Sericulture for Global Competitiveness, 5–6 November 2003, CSR&TI, Mysore: 19–27." },
  { year: 2003, citation: "Kar P. K., Ashok Kumar K., Sinha R. K. and Thangavelu K. (2003). Variability in esterase isozyme pattern in some races of silkworm Bombyx mori L. Proceedings of National Seminar on Mulberry Sericulture Research in India, 26–28 November 2001, KSSRDI, Bangalore: 660–665." },
  { year: 2003, citation: "Kumaresan P., Radhakrishnan S. and Sinha R. K. (2003). Variability in nutritional parameters of multivoltine silkworm races (Bombyx mori L.). Proceedings of National Seminar on Mulberry Sericulture Research in India, 26–28 November 2001, KSSRDI, Bangalore: 434–441." },
  // 2005 (seminar proceedings)
  { year: 2005, citation: "Muthulakshmi M., Balachandran N., Mohan B., Sinha R. K. and Thangavelu K. (2005). Promising bivoltine silkworm germplasm in silkworm crop improvement. National Seminar on Scenario of Sericulture in India, 25–26 March 2005, S. P. Mahila Visvavidyalayam, Tirupati: 17." },
  { year: 2005, citation: "Thangavelu K. and Sinha R. K. (2005). Strategies for conservation of muga (Antheraea assama) silkworm genetic resources. Proceedings of Workshop on Strategies of Non-mulberry Germplasm Maintenance, 10–11 March 2005, CMER&TI, Lahdoigarh, Jorhat: 29–36." },
]

/** Books, catalogues and major institutional publications he authored/edited. */
export const booksAndCatalogues: Publication[] = [
  { year: 2009, citation: "Catalogue on Silkworm, Bombyx mori L. — Vol. III & IV. Central Sericultural Germplasm Resources Centre, Hosur." },
  { year: 2008, citation: "Illustrated Manual on Management of Seri-genetic Resources in the Tropics. CSGRC, Hosur." },
  { year: 2003, citation: "Catalogue on Evaluation of Mulberry (Morus spp.) Germplasm — Vol. I. CSGRC, Hosur." },
  { year: 2003, citation: "Vision 2010 — Perspective Plan for CSGRC, Hosur." },
  { year: 2002, citation: "Catalogue on Silkworm, Bombyx mori L. — Vol. II. CSGRC, Hosur." },
  { year: 2001, citation: "Practical Handbook on Characterization, Evaluation and Database Management of Silkworm, Bombyx mori L. Germplasm. CSGRC, Hosur." },
  { year: 2001, citation: "Practical Handbook on Characterization, Evaluation and Database Management of Mulberry (Morus spp.) Germplasm. CSGRC, Hosur." },
  { year: 1997, citation: "Catalogue on Silkworm, Bombyx mori L. — Vol. I. CSGRC, Hosur." },
]

/** Popular / semi-technical articles written for the wider sericulture community.
    Several are in Hindi; two were awarded first prize for best technical article. */
export const popularArticles: Publication[] = [
  // 2007–08
  { year: 2007, citation: "Ponnuvel K. M., Koundinya P. R., Sinha R. K. & Kamble C. K. (2007). Immune response in silkworm Bombyx mori against microbial infection. Indian Silk 6: 9–11." },
  { year: 2007, citation: "Ponnuvel K. M., Koundinya P. R., Sinha R. K. and Kamble C. K. (2008). Biotechnology in the field of sericulture — an overview. Indian Silk." },
  // 2006–07
  { year: 2006, citation: "Koundinya P. R., Somasundram P., Kumaresan P., Sinha R. K. and Raje Urs S. (2006). Thermo-tolerance in mulberry silkworm. Indian Silk 45(5): 7–8." },
  { year: 2006, citation: "Kumaresan P., Sinha R. K. and Raje Urs S. (2006). Shahtoot janandraya — on-farm surakshan (Hindi). Resham Bharati 19(39): 4–5." },
  // 2005–06
  { year: 2005, citation: "Sinha R. K. and Saraswat R. P. (2005). Jaiv vividhita ke sandarbh mein vanya resham keeton ka sanrakshan (Hindi). Resham Bharati 18(37): 6–9. — First prize for best technical article in Hindi (CSB, Bangalore)." },
  // 2004–05
  { year: 2005, citation: "Kumaresan P., Sinha R. K., Koundinya P. R. and Thangavelu K. (2005). Role of multivoltine silkworm genetic resources to improve silk productivity. Indian Silk 44(2): 4–9." },
  { year: 2005, citation: "Mohan B., Muthulakshmi M., Balachandran N., Sinha R. K. and Thangavelu K. (2005). Improved method for pebrine detection in Bombyx mori L. silkworm germplasm stock. Indian Silk 43(9): 17–19." },
  { year: 2005, citation: "Saraswat R. P., Sinha R. K., Sen A. K. and Thangavelu K. (2005). Bauddhik swamitva adhikar (IPR) ki prasangikta va mahatva (Hindi). Indian Silk 43(9): 36–38." },
  // 2003–04
  { year: 2003, citation: "Koundinya P. R., Rayaraddar F. R., Kumaresan P., Murthy T. S. M., Sinha R. K. and Thangavelu K. (2003). Post-cocoon traits of silkworm germplasm. Indian Silk 42(8): 15–18." },
  { year: 2004, citation: "Kumaresan P., Mohan B., Koundinya P. R., Sinha R. K. and Thangavelu K. (2004). Silkworm germplasm conservation — a perspective. Indian Silk 42(12): 8–11." },
  { year: 2003, citation: "Sinha R. K. (2003). Resham jaiv vividhta — prabandhan karyayojana ka mahatva (Hindi). Resham Bharati 16(33): 31." },
  // 2002–03
  { year: 2002, citation: "Sinha R. K., Kumaresan P., Mohan B., Mahadevamurthy T. S. and Thangavelu K. (2002). Management and utilisation of silkworm germplasm. National Workshop on Sericultural Germplasm Management and Utilisation, 4–7 February 2002, CSGRC, Hosur: 73–81." },
  { year: 2003, citation: "Thangavelu K., Sinha R. K. and Mohan B. (2003). Silkworm germplasm and their potential use. Silkworm Breeders Summit 2003, 18–19 July 2003, APSSR&DI, Hindupur." },
  { year: 2003, citation: "Thangavelu K., Sinha R. K. and Tikader A. (2003). Progress in sericultural germplasm resources and management. Souvenir, National Conference on Tropical Sericulture for Global Competitiveness, 5–7 November 2003, CSR&TI, Mysore: 19–27." },
  { year: 2002, citation: "Sinha R. K. (2002). Status of non-mulberry silkworm and its host plants: A — tropical tasar. CSGRC News Letter 3(2): 3–4." },
  { year: 2002, citation: "Sinha R. K. (2002). Status of non-mulberry silkworm and its host plant germplasm resources: B — oak tasar, main problems and prospects. CSGRC News Letter 3(3): 3." },
  { year: 2003, citation: "Sinha R. K. (2003). Reshamkeet va unake bhojya podhon mein anuvanshik sudhar (Hindi). Resham Sankalan, CSGRC, Hosur: 3–5." },
  { year: 2002, citation: "Sinha R. K. and Saraswat R. P. (2002). Bharat mein resham jaiv vividhita sanrakshan, suraksha avam upyogita (Hindi). Resham Bharati 15(31): 4–11. — First prize for best technical article in Hindi (CSB, Bangalore)." },
  { year: 2002, citation: "Thangavelu K. and Sinha R. K. (2002). Utilization of genetic resources for silkworm breeding. Indian Silk, June: 21–24." },
  // 2000
  { year: 2000, citation: "Mukherjee P. and Sinha R. K. (2000). Collaboration in evaluation of germplasm. Indian Silk 39(4): 7–10." },
  { year: 2000, citation: "Dandin S. B., Mukherjee P. and Sinha R. K. (2000). Research strategy of silkworm and mulberry germplasm station. Indian Silk 38(9&10): 65–69." },
  { year: 2000, citation: "Sinha R. K. and Dandin S. B. (2000). Conservation of silkworm (Bombyx mori L.) genetic resources in India. Proceedings, 4th China International Silk Conference, 14–19 May 2000: 85–95." },
  // 1990s
  { year: 1998, citation: "Noamani M. K. R., Ibotombi Singh N., Sinha R. K., Ibohal Singh M. and James Keisa T. (1998). Oak tasar silkworm breeding and genetics (Base paper III). Workshop on Oak Tasar Culture, 29 September 1995, Bhimtal." },
  { year: 1992, citation: "Sinha R. K., Kulshresta V., Mishra P. K. and Thangavelu K. (1992). Constraints of the tasar silk industry in India. Indian Silk, May: 32." },
  { year: 1992, citation: "Thangavelu K. and Sinha R. K. (1991–92). Thrust areas of research in tasar culture. Quarterly News Bulletin, CTR&TI, Ranchi 5(3&4): 1–3." },
  { year: 1991, citation: "Thangavelu K. and Sinha R. K. (1991). Problems and prospects of the oak tasar industry in India. Quarterly News Bulletin, CTR&TI, Ranchi 5(1&2): 1–2." },
  { year: 1990, citation: "Prasad D. N., Sinha R. K. and Sinha S. S. (1990). Mulberry sericulture in the tribal area of South Bihar. Indian Silk, November: 29–31." },
  { year: 1989, citation: "Sinha R. K. and Sinha S. S. (1989). Afforestation: an important component of sericulture. In: Recent Researches in Ecology, Environment and Pollution (Eds. Trivedi, Sensharma & Singh), Today & Tomorrow's Printers & Publishers, New Delhi, 5: 95–104." },
]
