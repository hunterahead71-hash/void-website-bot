const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const socialsCommand = new SlashCommandBuilder()
  .setName('socials')
  .setDescription('List all Void eSports social media links.');

// REAL Void social media data - ONLY the links you provided
const socialPlatforms = [
  {
    name: 'Discord Roster Hub',
    url: 'https://discord.gg/void-esports-lf-investors-1197180527686463498',
    icon: '💬',
    color: 0x5865F2,
    inviteCode: 'void-esports-lf-investors-1197180527686463498'
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@voidesportsggs?_r=1&_t=ZT-92a7CN4YVqg',
    icon: '🎵',
    color: 0x000000,
    handle: '@voidesportsggs'
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@voidesports2x?si=PbRzUj_o9Q178kIj',
    icon: '🎥',
    color: 0xFF0000,
    handle: '@voidesports2x'
  },
  {
    name: 'Twitter / X',
    url: 'https://x.com/voidesports2x?s=21',
    icon: '🐦',
    color: 0x1DA1F2,
    handle: '@voidesports2x'
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/voidesports2x?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==',
    icon: '📸',
    color: 0xE4405F,
    handle: '@voidesports2x'
  }
];

const PER_PAGE = 5; // Show all on one page

function buildSocialsEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🔗 Void eSports - Official Social Links')
    .setDescription('Click the buttons below to visit each platform!')
    .setColor(0x8a2be2) // Void purple
    .setTimestamp()
    .setFooter({ text: 'All links are verified and managed by Void Esports' });

  // Add each social as a field with just name and link
  socialPlatforms.forEach(social => {
    embed.addFields({
      name: `${social.icon} **${social.name}**`,
      value: `🔗 [Click to visit](${social.url})${social.handle ? `\n🔖 ${social.handle}` : ''}`,
      inline: true
    });
  });

  return embed;
}

function buildSocialsButtons() {
  const rows = [];
  
  // Row 1: Direct platform buttons
  const platformRow = new ActionRowBuilder();
  
  socialPlatforms.forEach(social => {
    let buttonLabel = social.name;
    if (social.name === 'Twitter / X') buttonLabel = '𝕏';
    
    platformRow.addComponents(
      new ButtonBuilder()
        .setLabel(buttonLabel)
        .setEmoji(social.icon)
        .setStyle(ButtonStyle.Link)
        .setURL(social.url)
    );
  });
  
  rows.push(platformRow);
  
  return rows;
}

async function handleSocials(interaction) {
  const embed = buildSocialsEmbed();
  const rows = buildSocialsButtons();
  
  await interaction.editReply({ 
    embeds: [embed], 
    components: rows
  });
}

module.exports = {
  socialsCommand,
  handleSocials
};
