const mongoose = require('mongoose');

const conversationMessageSchema = new mongoose.Schema(
	{
		role: {
			type: String,
			enum: ['user', 'assistant'],
			required: true
		},
		content: {
			type: String,
			required: true,
			maxlength: 4000
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	},
	{ _id: false }
);

const conversationSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true
		},
		threadId: {
			type: String,
			required: true,
			index: true
		},
		channel: {
			type: String,
			default: 'learnerbot',
			index: true
		},
		title: {
			type: String,
			default: 'New Chat'
		},
		summary: {
			type: String,
			default: ''
		},
		summaryUpdatedAt: {
			type: Date
		},
		messages: [conversationMessageSchema],
		lastActiveAt: {
			type: Date,
			default: Date.now
		},
		isPinned: {
			type: Boolean,
			default: false
		}
	},
	{ timestamps: true }
);

conversationSchema.index({ userId: 1, threadId: 1 }, { unique: true });
conversationSchema.index({ userId: 1, lastActiveAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
const mongoose = require('mongoose');

const conversationMessageSchema = new mongoose.Schema(
	{
		role: {
			type: String,
			enum: ['user', 'assistant'],
			required: true
		},
		content: {
			type: String,
			required: true,
			maxlength: 4000
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	},
	{ _id: false }
);

const conversationSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			unique: true,
			index: true
		},
		channel: {
			type: String,
			default: 'learnerbot',
			index: true
		},
		messages: [conversationMessageSchema],
		lastActiveAt: {
			type: Date,
			default: Date.now
		}
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
