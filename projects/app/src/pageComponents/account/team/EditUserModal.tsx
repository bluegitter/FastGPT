import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Input,
  ModalBody,
  ModalFooter,
  Flex,
  FormLabel,
  Checkbox
} from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MySelect from '@fastgpt/web/components/common/MySelect';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { getTeamList, updateTeamMember } from '@/web/support/user/team/api';
import { useTranslation } from 'next-i18next';
import type { TeamTmbItemType } from '@fastgpt/global/support/user/team/type.d';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';

// 用户信息类型
interface UserInfo {
  tmbId: string;
  userId: string;
  teamId: string;
  teamName?: string;
  memberName: string;
  contact?: string;
  role: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userInfo?: UserInfo;
}

const EditUserModal = ({ isOpen, onClose, onSuccess = () => {}, userInfo }: EditUserModalProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teams, setTeams] = useState<TeamTmbItemType[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);

  // 获取用户可用的团队列表
  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    try {
      const data = await getTeamList('active');
      setTeams(data);
    } catch (error) {
      console.error('获取团队列表失败:', error);
      toast({ status: 'error', title: '获取团队列表失败' });
    }
    setIsLoadingTeams(false);
  };

  // 当弹窗打开时获取团队列表并设置初始值
  useEffect(() => {
    if (isOpen && userInfo) {
      setUsername(userInfo.memberName || '');
      setPassword(''); // 密码不显示原值
      setSelectedTeamId(''); // 先清空，等待团队列表加载后设置
      setIsAdmin(userInfo.role === TeamMemberRoleEnum.owner); // 根据角色初始化
      fetchTeams();
    }
  }, [isOpen, userInfo]);

  // 当团队列表加载完成后，确保设置正确的默认选中团队
  useEffect(() => {
    if (teams.length > 0 && userInfo?.teamId && !selectedTeamId) {
      // 处理用户团队ID可能是对象的情况
      const userTeamId =
        typeof userInfo.teamId === 'object'
          ? (userInfo.teamId as any)._id || (userInfo.teamId as any).teamId
          : userInfo.teamId;

      // 检查用户所属的团队是否在可用团队列表中
      const userTeam = teams.find((team) => team.teamId === userTeamId);

      if (userTeam) {
        setSelectedTeamId(userTeam.teamId);
      } else if (teams.length > 0) {
        // 如果用户所属的团队不在列表中，默认选择第一个团队
        setSelectedTeamId(teams[0].teamId);
      }
    }
  }, [teams, userInfo, selectedTeamId]);

  // 格式化团队列表为 MySelect 需要的格式
  const teamOptions = teams.map((team) => ({
    label: team.teamName,
    value: team.teamId,
    icon: team.teamAvatar || '/imgs/avatar/TealAvatar.svg',
    iconSize: '1.25rem'
  }));

  const handleEdit = async () => {
    if (!username.trim()) {
      toast({ status: 'warning', title: '请输入用户名' });
      return;
    }
    if (!selectedTeamId) {
      toast({ status: 'warning', title: '请选择团队' });
      return;
    }
    setIsEditing(true);
    try {
      // 调用更新用户信息的 API
      const updateData: any = {
        tmbId: userInfo?.tmbId,
        username: username.trim(),
        teamId: selectedTeamId,
        isAdmin
      };

      // 如果输入了密码，则包含密码
      if (password.trim()) {
        updateData.password = password.trim();
      }

      await updateTeamMember(userInfo?.tmbId || '', updateData);

      toast({ status: 'success', title: '更新成功' });
      setUsername('');
      setPassword('');
      setSelectedTeamId('');
      setIsAdmin(false);
      onClose();
      onSuccess();
    } catch (e: any) {
      toast({ status: 'error', title: e?.message || '更新失败' });
    }
    setIsEditing(false);
  };

  return (
    <MyModal
      isOpen={isOpen}
      onClose={onClose}
      title="编辑用户"
      iconSrc="common/userLight"
      maxW={['90vw', '400px']}
    >
      <ModalBody>
        <Flex direction="column" gap={4}>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              用户名
            </FormLabel>
            <Input
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEdit();
              }}
            />
          </Flex>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              新密码
            </FormLabel>
            <Input
              type="password"
              placeholder="留空则不修改密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEdit();
              }}
            />
          </Flex>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              所属团队
            </FormLabel>
            <Box flex={1}>
              <MySelect
                list={teamOptions}
                value={selectedTeamId}
                onChange={(value) => setSelectedTeamId(value)}
                placeholder="请选择团队"
                isLoading={isLoadingTeams}
              />
            </Box>
          </Flex>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              设置为团队管理员
            </FormLabel>
            <Checkbox isChecked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)}>
              设为管理员
            </Checkbox>
          </Flex>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button isLoading={isEditing} colorScheme="blue" onClick={handleEdit}>
          确认修改
        </Button>
        <Button ml={3} onClick={onClose}>
          取消
        </Button>
      </ModalFooter>
    </MyModal>
  );
};

export default EditUserModal;
