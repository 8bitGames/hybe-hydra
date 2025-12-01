const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find campaigns
    const campaigns = await prisma.campaign.findMany({
      include: { artist: true },
      take: 10
    });

    console.log('\n=== All Campaigns ===');
    campaigns.forEach(c => {
      console.log(`${c.id} | ${c.name} | ${c.artist?.name || c.artist?.stageName || 'No artist'} | ${c.status}`);
    });

    // Find Carly Pearce specifically
    const carlyCampaign = campaigns.find(c =>
      c.artist?.name?.toLowerCase().includes('carly') ||
      c.artist?.stageName?.toLowerCase().includes('carly')
    );

    if (carlyCampaign) {
      console.log('\n=== Carly Pearce Campaign ===');
      console.log(JSON.stringify(carlyCampaign, null, 2));
    } else {
      console.log('\nNo Carly Pearce campaign found');

      // Check artists table
      const artists = await prisma.artist.findMany({ take: 10 });
      console.log('\n=== Artists ===');
      artists.forEach(a => {
        console.log(`${a.id} | ${a.name} | ${a.stageName}`);
      });
    }
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
