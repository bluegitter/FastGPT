import { connectionMongo, getMongoModel } from '../../../../common/mongo';
const { Schema } = connectionMongo;
import type { InvitationSchemaType } from './type';
import { TeamMemberCollectionName } from '@fastgpt/global/support/user/team/constant';

const InvitationLinkSchema = new Schema({
  linkId: {
    type: String,
    required: true,
    unique: true
  },
  teamId: {
    type: String,
    required: true
  },
  usedTimesLimit: {
    type: Number,
    default: 10 // -1 表示无限制
  },
  forbidden: {
    type: Boolean,
    default: false
  },
  expires: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  members: [
    {
      type: Schema.Types.ObjectId,
      ref: TeamMemberCollectionName
    }
  ]
});

export const MongoInvitationLink = getMongoModel<InvitationSchemaType>(
  'invitation_links',
  InvitationLinkSchema
);
