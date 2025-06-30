import React, { useMemo } from 'react';
import { Box, ButtonProps } from '@chakra-ui/react';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useTranslation } from 'next-i18next';
import { getTeamList, putSwitchTeam } from '@/web/support/user/team/api';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import MySelect from '@fastgpt/web/components/common/MySelect';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useRouter } from 'next/router';

const TeamSelector = ({
  showManage,
  onChange,
  ...props
}: Omit<ButtonProps, 'onChange'> & {
  showManage?: boolean;
  onChange?: () => void;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { userInfo, setUserInfo } = useUserStore();
  const { setLoading } = useSystemStore();

  const { data: myTeams = [] } = useRequest2(() => getTeamList(TeamMemberStatusEnum.active), {
    manual: false,
    refreshDeps: [userInfo]
  });

  const { runAsync: onSwitchTeam } = useRequest2(
    async (teamId: string) => {
      setLoading(true);
      await putSwitchTeam(teamId);
    },
    {
      onFinally: () => {
        // router.reload();
        setLoading(false);
      },
      errorToast: t('common:user.team.Switch Team Failed')
    }
  );

  const teamList = useMemo(() => {
    return myTeams.map((team) => ({
      icon: team.avatar,
      iconSize: '1.25rem',
      label: team.teamName,
      value: team.teamId
    }));
  }, [myTeams]);

  const formatTeamList = useMemo(() => {
    return [
      ...(showManage
        ? [
            {
              icon: 'common/setting',
              iconSize: '1.25rem',
              label: t('user:manage_team'),
              value: 'manage',
              showBorder: true
            }
          ]
        : []),
      ...teamList
    ];
  }, [showManage, t, teamList]);

  const handleChange = (value: string) => {
    if (value === 'manage') {
      router.push('/account/team');
    } else {
      try {
        onSwitchTeam(value);

        const newTeam = myTeams.find((t) => String(t.teamId) === value);
        if (newTeam && userInfo) {
          // 仅更新 userInfo.team，不破坏其他信息
          setUserInfo({
            ...userInfo,
            team: {
              ...userInfo.team,
              teamId: newTeam.teamId,
              teamName: newTeam.teamName,
              avatar: newTeam.avatar
              // 保留原有字段（如 memberName, tmbId 等）
            },
            permission: userInfo.team?.permission // 外层同步指向 team 的权限
          });
        }

        console.log('切换团队成功：', newTeam);
        // 如果你不想刷新页面，可以去掉这行：
        // router.reload();

        if (onChange) onChange();
      } catch (e) {
        // toast 已由 useRequest2 自动处理
      }
    }
  };

  return (
    <Box w={'100%'}>
      <MySelect
        {...props}
        value={userInfo?.team?.teamId}
        list={formatTeamList}
        onChange={handleChange}
      />
    </Box>
  );
};

export default TeamSelector;
