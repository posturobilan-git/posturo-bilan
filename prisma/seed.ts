import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ExerciseCategory, ComponentCategory } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EXERCISES: Array<{
  name: string;
  description: string;
  category: ExerciseCategory;
  frequency?: string;
  duration?: string;
}> = [
  { name: "Étirement du psoas", description: "Fente avant, bassin rétroversé, étirement de la chaîne antérieure de la hanche.", category: "SOUPLESSE", frequency: "2×/jour", duration: "30 s par côté" },
  { name: "Gainage planche", description: "Maintien isométrique en appui avant-bras, dos neutre.", category: "RENFORCEMENT", frequency: "1×/jour", duration: "3 × 45 s" },
  { name: "Mobilité thoracique", description: "Rotation du segment thoracique en quadrupédie, main derrière la tête.", category: "MOBILITE", frequency: "1×/jour", duration: "10 répétitions/côté" },
  { name: "Renforcement VMO", description: "Extension de genou en fin d'amplitude pour le vaste médial oblique.", category: "RENFORCEMENT", frequency: "3×/semaine", duration: "3 × 15" },
  { name: "Étirement ischio-jambiers", description: "Flexion de hanche jambe tendue, dos droit.", category: "SOUPLESSE", frequency: "2×/jour", duration: "30 s par jambe" },
  { name: "Proprioception cheville", description: "Équilibre unipodal sur surface instable, yeux ouverts puis fermés.", category: "PROPRIOCEPTION", frequency: "1×/jour", duration: "3 × 30 s" },
  { name: "Mobilité hanche 90/90", description: "Travail des rotations interne et externe de hanche en position assise.", category: "MOBILITE", frequency: "1×/jour", duration: "10 transitions" },
  { name: "Renforcement moyen fessier", description: "Abduction de hanche en décubitus latéral, contrôle du bassin.", category: "RENFORCEMENT", frequency: "3×/semaine", duration: "3 × 15/côté" },
];

const COMPONENTS: Array<{
  name: string;
  brand?: string;
  model?: string;
  category: ComponentCategory;
  notes?: string;
}> = [
  { name: "Selle Arione R3", brand: "Fizik", model: "Arione R3", category: "SELLE", notes: "Selle longue, bassin peu mobile." },
  { name: "Selle Antares R3", brand: "Fizik", model: "Antares R3", category: "SELLE", notes: "Bassin à mobilité moyenne." },
  { name: "Selle SR", brand: "Ergon", model: "SR Pro", category: "SELLE", notes: "Canal central, confort périnéal." },
  { name: "Potence SL-K", brand: "FSA", model: "SL-K", category: "POTENCE", notes: "Disponible 90–120 mm." },
  { name: "Potence Pro PLT", brand: "Pro", model: "PLT", category: "POTENCE" },
  { name: "Cintre Compact", brand: "Deda", model: "Zero100", category: "CINTRE", notes: "Drop court, reach 75 mm." },
  { name: "Cales SPD-SL", brand: "Shimano", model: "SM-SH11", category: "CALE_PIEDS", notes: "Jeu 6°, jaune." },
  { name: "Cales SPD-SL fixes", brand: "Shimano", model: "SM-SH10", category: "CALE_PIEDS", notes: "Jeu 0°, rouge." },
  { name: "Manivelles 170 mm", brand: "Shimano", model: "Ultegra R8000", category: "MANIVELLES", notes: "Pour petits gabarits." },
  { name: "Pédales Keo", brand: "Look", model: "Keo 2 Max", category: "PEDALES" },
];

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
    (await prisma.user.findFirst());

  if (!admin) {
    throw new Error(
      "Aucun utilisateur en base. Connectez-vous une première fois via Clerk pour créer le compte admin, puis relancez le seed."
    );
  }

  let exCreated = 0;
  for (const ex of EXERCISES) {
    const exists = await prisma.exercise.findFirst({ where: { name: ex.name } });
    if (exists) continue;
    await prisma.exercise.create({ data: { ...ex, createdById: admin.id } });
    exCreated++;
  }

  let compCreated = 0;
  for (const comp of COMPONENTS) {
    const exists = await prisma.bikeComponent.findFirst({ where: { name: comp.name } });
    if (exists) continue;
    await prisma.bikeComponent.create({ data: { ...comp, createdById: admin.id } });
    compCreated++;
  }

  console.log(
    `Seed terminé : ${exCreated}/${EXERCISES.length} exercices, ${compCreated}/${COMPONENTS.length} composants créés (attribués à ${admin.email}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
