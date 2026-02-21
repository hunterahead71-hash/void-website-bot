const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const socialsCommand = new SlashCommandBuilder()
  .setName('socials')
  .setDescription('List all Void eSports social media links and platforms.');

const PER_PAGE = 3; // Show 3 socials per page (since we have 5 total)

// REAL Void social media data - ONLY these links
const socialPlatforms = [
  {
    name: 'Discord',
    url: 'https://discord.gg/void-esports-lf-investors-1197180527686463498',
    icon: '💬',
    color: 0x5865F2,
    description: 'Join our community! Chat with fans, players, and investors',
    members: 'Active',
    category: 'community',
    inviteCode: 'void-esports-lf-investors-1197180527686463498'
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@voidesportsggs?_r=1&_t=ZT-92a7CN4YVqg',
    icon: '🎵',
    color: 0x000000,
    description: 'Short clips, memes, and viral content',
    followers: 'Growing',
    category: 'social',
    handle: '@voidesportsggs'
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@voidesports2x?si=PbRzUj_o9Q178kIj',
    icon: '🎥',
    color: 0xFF0000,
    description: 'Highlights, vlogs, and tournament recaps',
    subscribers: 'Subscribe!',
    category: 'video',
    handle: '@voidesports2x'
  },
  {
    name: 'Twitter / X',
    url: 'https://x.com/voidesports2x?s=21',
    icon: '🐦',
    color: 0x1DA1F2,
    description: 'Latest news, updates, and community engagement',
    followers: 'Follow us!',
    category: 'social',
    handle: '@voidesports2x'
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/voidesports2x?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==',
    icon: '📸',
    color: 0xE4405F,
    description: 'Behind the scenes, photos, and lifestyle content',
    followers: 'Follow us!',
    category: 'social',
    handle: '@voidesports2x'
  }
];

// Keep them in a logical order (Discord first, then social platforms)
const orderedPlatforms = [
  socialPlatforms.find(p => p.name === 'Discord'),
  socialPlatforms.find(p => p.name === 'YouTube'),
  socialPlatforms.find(p => p.name === 'Twitter / X'),
  socialPlatforms.find(p => p.name === 'Instagram'),
  socialPlatforms.find(p => p.name === 'TikTok')
].filter(Boolean); // Remove any undefined just in case

function buildSocialsEmbed(page = 0) {
  const totalPages = Math.ceil(orderedPlatforms.length / PER_PAGE);
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const start = p * PER_PAGE;
  const end = Math.min(start + PER_PAGE, orderedPlatforms.length);
  const currentSocials = orderedPlatforms.slice(start, end);

  // Create a visually stunning embed
  const embed = new EmbedBuilder()
    .setTitle('🌐 Void eSports - Official Social Links')
    .setDescription('🔗 **Connect with us across all platforms!**\nClick the buttons below to join our communities.')
    .setColor(0x8a2be2) // Void purple
    .setTimestamp()
    .setFooter({ 
      text: `Page ${p + 1}/${totalPages} • ${orderedPlatforms.length} platforms • Last updated: Feb 2026`,
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' // Replace with your server icon/emote
    })
    .setThumbnail('https://media.discordapp.net/attachments/123456789/void-logo.png') // Replace with actual Void logo URL
    .setImage('https://media.discordapp.net/attachments/123456789/void-banner.png'); // Optional banner

  // Add a fancy header field
  embed.addFields({
    name: '📢 **Official Channels**',
    value: 'All links below are verified and managed directly by Void Esports staff.',
    inline: false
  });

  // Add fields for each social on current page with rich formatting
  currentSocials.forEach(social => {
    let fieldValue = `**━━━━━━━━━━━━━**\n`;
    fieldValue += `${social.description}\n`;
    fieldValue += `**━━━━━━━━━━━━━**\n`;
    
    // Add platform-specific stats
    if (social.members) fieldValue += `👥 **Members:** ${social.members}\n`;
    if (social.followers) fieldValue += `👥 **Followers:** ${social.followers}\n`;
    if (social.subscribers) fieldValue += `📺 **Subscribers:** ${social.subscribers}\n`;
    if (social.handle) fieldValue += `🔖 **Handle:** ${social.handle}\n`;
    
    // Add clickable link hint
    fieldValue += `\n🔗 **[Click the button below to join!]**`;
    
    embed.addFields({
      name: `${social.icon} **${social.name}**`,
      value: fieldValue,
      inline: true
    });
    
    // Add empty field for alignment if needed
    if (currentSocials.length === 2 && currentSocials.indexOf(social) === 0) {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }
  });

  return { embed, totalPages, currentPage: p, currentSocials };
}

function buildSocialsButtons(currentPage, totalPages, currentSocials) {
  const rows = [];
  
  // Row 1: Direct platform buttons (Link buttons)
  const platformRow = new ActionRowBuilder();
  currentSocials.forEach(social => {
    // Choose emoji based on platform
    let emoji = '🔗';
    if (social.name === 'Discord') emoji = '💬';
    else if (social.name === 'TikTok') emoji = '🎵';
    else if (social.name === 'YouTube') emoji = '🎥';
    else if (social.name === 'Twitter / X') emoji = '🐦';
    else if (social.name === 'Instagram') emoji = '📸';
    
    // Truncate name for button
    let buttonLabel = social.name;
    if (social.name === 'Twitter / X') buttonLabel = '𝕏 Twitter';
    else if (social.name === 'Discord') buttonLabel = 'Discord';
    
    platformRow.addComponents(
      new ButtonBuilder()
        .setLabel(buttonLabel)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Link)
        .setURL(social.url)
    );
  });
  
  // Add platform row if there are any buttons
  if (platformRow.components.length > 0) {
    rows.push(platformRow);
  }
  
  // Row 2: Pagination and utility buttons
  const navRow = new ActionRowBuilder();
  
  // Previous page button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`socials_prev_${currentPage}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0)
      .setEmoji('⬅️')
  );
  
  // Page indicator (disabled)
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId('socials_page_indicator')
      .setLabel(`📄 Page ${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
  
  // Next page button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`socials_next_${currentPage}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages - 1)
      .setEmoji('➡️')
  );
  
  rows.push(navRow);
  
  // Row 3: Additional utility buttons (optional)
  const utilityRow = new ActionRowBuilder();
  
  // Copy all links button (ephemeral response)
  utilityRow.addComponents(
    new ButtonBuilder()
      .setCustomId('socials_copy_all')
      .setLabel('📋 Copy All Links')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('socials_invite_bot')
      .setLabel('🤖 Invite Bot')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➕')
  );
  
  rows.push(utilityRow);
  
  return rows;
}

async function handleSocials(interaction, page = 0) {
  const { embed, totalPages, currentPage, currentSocials } = buildSocialsEmbed(page);
  const rows = buildSocialsButtons(currentPage, totalPages, currentSocials);
  
  await interaction.editReply({ 
    embeds: [embed], 
    components: rows,
    content: '** **' // Empty content for spacing
  });
}

async function handleSocialsPaginated(interaction, direction) {
  try {
    // Extract current page from custom ID
    const customId = interaction.customId;
    const isPrev = customId.includes('prev');
    const currentPage = parseInt(customId.split('_')[2], 10);
    
    let newPage = isPrev ? currentPage - 1 : currentPage + 1;
    
    const { embed, totalPages, currentPage: newCurrentPage, currentSocials } = buildSocialsEmbed(newPage);
    const rows = buildSocialsButtons(newCurrentPage, totalPages, currentSocials);
    
    await interaction.update({ 
      embeds: [embed], 
      components: rows 
    });
  } catch (error) {
    console.error('Socials pagination error:', error);
    await interaction.update({ 
      content: '❌ Error loading page. Please try again.', 
      embeds: [], 
      components: [] 
    });
  }
}

async function handleCopyAllLinks(interaction) {
  // Create a formatted list of all links
  const linksList = orderedPlatforms.map(p => {
    let emoji = '';
    if (p.name === 'Discord') emoji = '💬';
    else if (p.name === 'TikTok') emoji = '🎵';
    else if (p.name === 'YouTube') emoji = '🎥';
    else if (p.name === 'Twitter / X') emoji = '🐦';
    else if (p.name === 'Instagram') emoji = '📸';
    
    return `${emoji} **${p.name}**: ${p.url}`;
  }).join('\n');
  
  const embed = new EmbedBuilder()
    .setTitle('📋 All Void Social Links')
    .setDescription(linksList)
    .setColor(0x8a2be2)
    .setFooter({ text: 'Copy any link by clicking the button below!' })
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('socials_copy_discord')
        .setLabel('Copy Discord')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId('socials_copy_youtube')
        .setLabel('Copy YouTube')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎥'),
      new ButtonBuilder()
        .setCustomId('socials_copy_twitter')
        .setLabel('Copy Twitter')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🐦'),
      new ButtonBuilder()
        .setCustomId('socials_copy_instagram')
        .setLabel('Copy Insta')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📸'),
      new ButtonBuilder()
        .setCustomId('socials_copy_tiktok')
        .setLabel('Copy TikTok')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎵')
    );
  
  await interaction.reply({ 
    embeds: [embed], 
    components: [row],
    ephemeral: true // Only visible to the user who clicked
  });
}

async function handleCopySingleLink(interaction, platform) {
  const social = orderedPlatforms.find(p => 
    p.name.toLowerCase().includes(platform) || 
    (platform === 'twitter' && p.name.includes('Twitter'))
  );
  
  if (!social) {
    await interaction.reply({ 
      content: '❌ Platform not found.', 
      ephemeral: true 
    });
    return;
  }
  
  await interaction.reply({ 
    content: `🔗 **${social.name}**: ${social.url}`,
    ephemeral: true 
  });
}

async function handleInviteBot(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Invite Void Bot')
    .setDescription('Add this bot to your own server!')
    .addFields(
      { name: '🔗 Invite Link', value: '[Click here to invite](https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands)', inline: false },
      { name: '📚 Documentation', value: 'Coming soon!', inline: false },
      { name: '🆘 Support', value: 'Join our [Discord](https://discord.gg/void-esports-lf-investors-1197180527686463498) for help!', inline: false }
    )
    .setColor(0x8a2be2)
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands')
        .setEmoji('🤖'),
      new ButtonBuilder()
        .setLabel('Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/void-esports-lf-investors-1197180527686463498')
        .setEmoji('💬')
    );
  
  await interaction.reply({ 
    embeds: [embed], 
    components: [row],
    ephemeral: true 
  });
}

module.exports = {
  socialsCommand,
  handleSocials,
  handleSocialsPaginated,
  handleCopyAllLinks,
  handleCopySingleLink,
  handleInviteBot
};
