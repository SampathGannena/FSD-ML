// Quick script to fix old messages in database
// This updates messages that have the wrong field name

const mongoose = require('mongoose');
require('dotenv').config();

const Message = require('./models/Message');

async function fixMessages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all messages that don't have senderName field
    const messagesWithoutSenderName = await Message.find({ 
      senderName: { $exists: false } 
    });

    console.log(`Found ${messagesWithoutSenderName.length} messages without senderName field`);

    if (messagesWithoutSenderName.length === 0) {
      console.log('✅ All messages are already correctly formatted!');
      process.exit(0);
    }

    // Update each message
    let updatedCount = 0;
    for (const msg of messagesWithoutSenderName) {
      // Set senderName to 'Anonymous' since we don't have the original sender
      msg.senderName = 'Anonymous';
      await msg.save();
      updatedCount++;
    }

    console.log(`✅ Updated ${updatedCount} messages`);
    console.log('All messages now have senderName field!');

    // Alternatively, you could delete all old messages:
    // const result = await Message.deleteMany({ senderName: { $exists: false } });
    // console.log(`Deleted ${result.deletedCount} old messages`);

    process.exit(0);
  } catch (error) {
    console.error('Error fixing messages:', error);
    process.exit(1);
  }
}

fixMessages();
