/**
 * Curated study materials for going deeper on your DNA — real, authoritative,
 * mostly-free resources. Grouped so a beginner and a researcher each have a
 * path. Every link is a public educational source; nothing personal here.
 */

export type StudyResource = {
  title: string
  by: string
  what: string
  url: string
  /** rough level so people self-select. */
  level: "start here" | "go deeper" | "reference"
}

export type StudyGroup = {
  heading: string
  blurb: string
  items: StudyResource[]
}

export const DNA_STUDY: StudyGroup[] = [
  {
    heading: "Learn how DNA works",
    blurb: "Start from the mechanism — what genes are, how variants arise, how a genotype becomes a trait.",
    items: [
      {
        title: "MedlinePlus Genetics — Help Me Understand Genetics",
        by: "U.S. National Library of Medicine",
        what: "The best plain-language primer on cells, DNA, genes, variants, and inheritance. Free, authoritative, no jargon.",
        url: "https://medlineplus.gov/genetics/understanding/",
        level: "start here",
      },
      {
        title: "Talking Glossary of Genetic Terms",
        by: "National Human Genome Research Institute (NHGRI)",
        what: "Every term on this page — allele, SNP, heterozygous, phenotype — explained with audio + illustrations.",
        url: "https://www.genome.gov/genetics-glossary",
        level: "start here",
      },
      {
        title: "Khan Academy — Classical & Molecular Genetics",
        by: "Khan Academy",
        what: "Free video course from Mendel to modern genomics — the structured way to actually learn it.",
        url: "https://www.khanacademy.org/science/ap-biology/heredity",
        level: "go deeper",
      },
    ],
  },
  {
    heading: "The science behind the traits",
    blurb: "Where the trait interpretations come from — the databases + the published research.",
    items: [
      {
        title: "dbSNP",
        by: "NCBI",
        what: "Look up any rs-number to see the variant, its frequencies across populations, and its clinical links.",
        url: "https://www.ncbi.nlm.nih.gov/snp/",
        level: "reference",
      },
      {
        title: "GWAS Catalog",
        by: "EMBL-EBI & NHGRI",
        what: "Search a trait to see every published study that linked a variant to it, with the papers.",
        url: "https://www.ebi.ac.uk/gwas/",
        level: "reference",
      },
      {
        title: "PubMed",
        by: "NCBI",
        what: "The index of biomedical literature. Every trait card here links to its key paper's PubMed record — start there and follow the citations.",
        url: "https://pubmed.ncbi.nlm.nih.gov/",
        level: "go deeper",
      },
      {
        title: "ClinVar",
        by: "NCBI",
        what: "For health-relevant variants: the archive of variant–condition relationships with expert-reviewed significance.",
        url: "https://www.ncbi.nlm.nih.gov/clinvar/",
        level: "reference",
      },
    ],
  },
  {
    heading: "DNA & human origins",
    blurb: "How your variants trace migrations, and how genetics reads the human story.",
    items: [
      {
        title: "The Genographic legacy & population genetics basics",
        by: "Nature Education — Scitable",
        what: "Readable articles on how DNA reconstructs ancestry, migration, and human evolution.",
        url: "https://www.nature.com/scitable/topics/genetics-5/",
        level: "go deeper",
      },
      {
        title: "1000 Genomes Project",
        by: "International Genome Sample Resource (IGSR)",
        what: "The open reference dataset of human variation across world populations — the backbone of ancestry science.",
        url: "https://www.internationalgenome.org/",
        level: "reference",
      },
    ],
  },
  {
    heading: "Machine learning & pattern recognition in DNA",
    blurb: "Genomes are data. Modern genetics is increasingly about finding PATTERNS in billions of letters — this is where ML meets DNA.",
    items: [
      {
        title: "Deep learning for genomics — a primer",
        by: "Nature Genetics / review literature",
        what: "How neural nets predict function from sequence (splice sites, regulatory regions, variant effects). The bridge from biology to models.",
        url: "https://www.nature.com/subjects/machine-learning",
        level: "go deeper",
      },
      {
        title: "DeepVariant",
        by: "Google",
        what: "An open-source deep-learning tool that calls genetic variants from sequencing data by treating the pileup as an image — pattern recognition, literally.",
        url: "https://github.com/google/deepvariant",
        level: "reference",
      },
      {
        title: "AlphaFold & AlphaMissense",
        by: "Google DeepMind",
        what: "ML that predicts protein structure from sequence, and whether a variant is likely benign or pathogenic — the frontier of learning function from letters.",
        url: "https://alphafold.ebi.ac.uk/",
        level: "go deeper",
      },
      {
        title: "Polygenic scores — how patterns across many variants predict traits",
        by: "PGS Catalog",
        what: "Most traits aren't one gene — they're thousands of tiny effects summed. This is the statistical/ML method (and its limits) behind 'genetic risk'.",
        url: "https://www.pgscatalog.org/",
        level: "go deeper",
      },
    ],
  },
  {
    heading: "Types of genome / DNA study",
    blurb: "Not all genetic testing is the same. Knowing which method produced the data tells you what it can — and can't — say.",
    items: [
      {
        title: "Genotyping arrays (SNP chips)",
        by: "what this page uses",
        what: "Reads ~600k–1M pre-chosen common variants. Cheap, fast, great for ancestry + common-trait associations — but it only sees the variants it was designed to check.",
        url: "https://www.genome.gov/genetics-glossary/Genotyping",
        level: "start here",
      },
      {
        title: "Whole-genome sequencing (WGS)",
        by: "NHGRI",
        what: "Reads essentially all 3.2 billion letters — rare variants included. The gold standard, more expensive, far more data to interpret.",
        url: "https://www.genome.gov/about-genomics/fact-sheets/Whole-Genome-Association-Studies",
        level: "go deeper",
      },
      {
        title: "Whole-exome sequencing (WES)",
        by: "NHGRI",
        what: "Sequences just the ~1–2% of the genome that codes for proteins — where most known disease variants live. A focused middle ground.",
        url: "https://www.genome.gov/genetics-glossary/Exome-Sequencing",
        level: "go deeper",
      },
      {
        title: "GWAS — genome-wide association studies",
        by: "NHGRI",
        what: "The study DESIGN behind most trait cards here: scan variants across thousands of people to find which ones associate with a trait. Association, not causation.",
        url: "https://www.genome.gov/genetics-glossary/Genome-Wide-Association-Studies",
        level: "go deeper",
      },
    ],
  },
  {
    heading: "Read your own data (advanced)",
    blurb: "Want to go past this page and analyse your raw file yourself?",
    items: [
      {
        title: "Promethease / open interpretation tools",
        by: "various (open-source ecosystem)",
        what: "How people run their own raw genotype files against SNP literature. Understand the privacy trade-offs before uploading anywhere.",
        url: "https://www.snpedia.com/index.php/Promethease",
        level: "go deeper",
      },
      {
        title: "GWAS Catalog summary-statistics + tutorials",
        by: "EMBL-EBI Training",
        what: "Free courses on reading GWAS data and polygenic scores — the real methods, honestly taught.",
        url: "https://www.ebi.ac.uk/training/on-demand/",
        level: "go deeper",
      },
    ],
  },
]
