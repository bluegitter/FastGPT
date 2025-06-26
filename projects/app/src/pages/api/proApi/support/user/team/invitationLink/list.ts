import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import type { InvitationType } from '@fastgpt/service/support/user/team/invitationLink/type';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'GET') {
      // 检查是否有管理权限
      const member = await MongoTeamMember.findOne({ _id: tmbId, teamId });
      if (!member || member.role !== TeamMemberRoleEnum.owner) {
        return jsonRes(res, {
          code: 403,
          error: 'No permission'
        });
      }

      // 这里需要根据你的邀请链接数据结构来实现
      // 假设你有一个邀请链接的集合，需要查询数据库

      // 示例数据结构，根据 InvitationType 定义
      const invitationLinks: InvitationType[] = [
        {
          _id: '1',
          linkId: 'abc123',
          teamId,
          usedTimesLimit: 10,
          forbidden: false,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
          description: '邀请团队成员',
          members: [
            {
              tmbId: 'member1',
              avatar: '/icon/human.svg',
              name: '张三'
            },
            {
              tmbId: 'member2',
              avatar: '/icon/human.svg',
              name: '李四'
            }
          ]
        }
      ];

      // 实际实现时，应该从数据库查询：
      // const invitationLinks = await MongoInvitationLink.find({ teamId })
      //   .populate('members', 'tmbId avatar name')
      //   .lean();

      jsonRes(res, {
        data: invitationLinks
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
