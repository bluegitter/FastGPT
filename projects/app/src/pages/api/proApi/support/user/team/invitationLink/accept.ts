import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
// 你需要有 MongoInvitationLink 模型，假设你已实现
import { MongoInvitationLink } from '@fastgpt/service/support/user/team/invitationLink/schema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    const { linkId, userId } = req.body;

    if (!linkId || !userId) {
      return jsonRes(res, { code: 400, error: 'Missing linkId or userId' });
    }

    // 查询邀请链接
    const invitation = await MongoInvitationLink.findOne({ linkId }).lean();
    if (!invitation) {
      return jsonRes(res, { code: 404, error: 'Invitation link not found' });
    }

    // 校验邀请链接状态
    if (invitation.forbidden) {
      return jsonRes(res, { code: 403, error: 'Invitation link is forbidden' });
    }
    if (invitation.expires && new Date(invitation.expires) < new Date()) {
      return jsonRes(res, { code: 410, error: 'Invitation link has expired' });
    }
    if (
      typeof invitation.usedTimesLimit === 'number' &&
      invitation.usedTimesLimit > 0 &&
      invitation.members.length >= invitation.usedTimesLimit
    ) {
      return jsonRes(res, { code: 429, error: 'Invitation link usage limit reached' });
    }

    // 校验用户是否已在团队
    const existMember = await MongoTeamMember.findOne({
      teamId: invitation.teamId,
      userId
    });
    if (existMember) {
      return jsonRes(res, { code: 409, error: 'User is already a team member' });
    }

    // 查询用户信息
    const user = await MongoUser.findById(userId);
    if (!user) {
      return jsonRes(res, { code: 404, error: 'User not found' });
    }

    // 加入团队成员
    const newMember = await MongoTeamMember.create({
      teamId: invitation.teamId,
      userId: user._id,
      name: user.username,
      status: TeamMemberStatusEnum.active,
      createTime: new Date()
    });

    // 更新邀请链接的 members 字段
    await MongoInvitationLink.updateOne({ linkId }, { $push: { members: newMember._id } });

    jsonRes(res, {
      data: {
        success: true,
        memberId: newMember._id
      }
    });
  } catch (error) {
    jsonRes(res, { code: 500, error });
  }
}
