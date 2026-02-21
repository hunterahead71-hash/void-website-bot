const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const mgmtInfoCommand = new SlashCommandBuilder()
  .setName('mgmt_info')
  .setDescription('List all management members and their roles (e.g. Alex – CTO, Frank – Founder).');

async function handleMgmtInfo(interaction) {
  try {
    const db = getFirestoreInstance();
    const snap = await db.collection('management').get().catch(() => null);
    if (!snap || !snap.docs || snap.docs.length === 0) {
      await interaction.editReply('❌ No management members found. Add a `management` collection on the website with documents containing `name` and `role`.');
      return;
    }
    const members = snap.docs.map(doc => convertFirestoreData(doc));
    const lines = members.map(m => {
      const name = m.name || m.displayName || 'Unknown';
      const role = m.role || m.title || '—';
      return `**${name}** — ${role}`;
    });
    const embed = new EmbedBuilder()
      .setTitle('👔 Management')
      .setDescription(lines.join('\n'))
      .setColor(0x2f3136)
      .setTimestamp()
      .setFooter({ text: 'Void eSports • Live from website' });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('mgmt_info error:', error);
    await interaction.editReply('❌ Failed to fetch management info.');
  }
}

module.exports = {
  mgmtInfoCommand,
  handleMgmtInfo
};
