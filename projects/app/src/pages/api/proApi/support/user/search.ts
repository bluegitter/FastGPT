import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'GET') {
      const { searchKey = '', members = true, orgs = true, groups = true } = req.query;

      const searchKeyStr = String(searchKey).trim();

      // 如果没有搜索关键词，返回空结果
      if (!searchKeyStr) {
        return jsonRes(res, {
          data: {
            members: [],
            orgs: [],
            groups: []
          }
        });
      }

      const results: {
        members: any[];
        orgs: any[];
        groups: any[];
      } = {
        members: [],
        orgs: [],
        groups: []
      };

      // 搜索团队成员
      if (members === 'true') {
        const memberPipeline = [
          {
            $match: {
              teamId: new Types.ObjectId(teamId),
              status: 'active'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'userInfo'
            }
          },
          {
            $unwind: {
              path: '$userInfo',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $match: {
              $or: [
                { name: { $regex: searchKeyStr, $options: 'i' } },
                { 'userInfo.username': { $regex: searchKeyStr, $options: 'i' } }
              ]
            }
          },
          {
            $project: {
              tmbId: '$_id',
              userId: '$userId',
              username: '$userInfo.username',
              memberName: '$name',
              avatar: { $ifNull: ['$avatar', '$userInfo.avatar'] },
              role: '$role',
              status: '$status',
              createTime: '$createTime',
              updateTime: '$updateTime'
            }
          },
          { $limit: 10 }
        ];

        const memberResults = await MongoTeamMember.aggregate(memberPipeline);
        results.members = memberResults.map((member) => ({
          ...member,
          avatar: member.avatar || '/icon/human.svg'
        }));
      }

      // 搜索组织
      if (orgs === 'true') {
        const orgMatch: any = {
          teamId: new Types.ObjectId(teamId)
        };

        if (searchKeyStr) {
          orgMatch.name = { $regex: searchKeyStr, $options: 'i' };
        }

        const orgResults = await MongoOrgModel.find(orgMatch)
          .select('_id teamId pathId path name avatar description updateTime')
          .sort({ updateTime: -1 })
          .limit(10)
          .lean();

        results.orgs = orgResults.map((org) => ({
          _id: org._id,
          teamId: org.teamId,
          pathId: org.pathId,
          path: org.path,
          name: org.name,
          avatar: org.avatar || '/icon/logo.svg',
          description: org.description || '',
          updateTime: org.updateTime
        }));
      }

      // 搜索成员组
      if (groups === 'true') {
        const groupMatch: any = {
          teamId: new Types.ObjectId(teamId)
        };

        if (searchKeyStr) {
          groupMatch.name = { $regex: searchKeyStr, $options: 'i' };
        }

        const groupResults = await MongoMemberGroupModel.find(groupMatch)
          .select('_id teamId name avatar updateTime')
          .sort({ updateTime: -1 })
          .limit(10)
          .lean();

        results.groups = groupResults.map((group) => ({
          _id: group._id,
          teamId: group.teamId,
          name: group.name,
          avatar: group.avatar || '/icon/logo.svg',
          updateTime: group.updateTime
        }));
      }

      jsonRes(res, {
        data: results
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('用户搜索失败:', error);
    jsonRes(res, {
      code: 500,
      error: '搜索失败'
    });
  }
}
