import React from 'react';
import { Easing } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { TeamsScreen } from '../screens/TeamsScreen';
import { TeamDetailScreen } from '../screens/TeamDetailScreen';
import { TeamManagementScreen } from '../screens/TeamManagementScreen';
import { ShiftManagementScreen } from '../screens/ShiftManagementScreen';
import { TimesheetScreen } from '../screens/TimesheetScreen';
import { AreaRoleManagementScreen } from '../screens/AreaRoleManagementScreen';
import { ShiftCheckInScreen } from '../screens/ShiftCheckInScreen';
import { ShiftLocationManagementScreen } from '../screens/ShiftLocationManagementScreen';
import { CreateTeamScreen } from '../screens/CreateTeamScreen';
import { JoinTeamInAppScreen } from '../screens/JoinTeamInAppScreen';
import { RoleCreationScreen } from '../screens/RoleCreationScreen';
import { RoleLevelScreen } from '../screens/RoleLevelScreen';
import { PermissionAssignmentScreen } from '../screens/PermissionAssignmentScreen';
import { MemberRoleScreen } from '../screens/MemberRoleScreen';
import { MemberProfileScreen } from '../screens/MemberProfileScreen';
import { colors, typography, TRANSITION_DURATION } from '../utils/theme';
import type { Team, UserProfile } from '../types';
import type { Role, RoleLevel, Member } from '../types/rbac';

export type TeamsStackParamList = {
  TeamsList: undefined;
  TeamDetail: { team: Team & { role?: string } };
  TeamManagement: { team: Team & { role?: string } };
  MemberProfile: { user: UserProfile };
  ShiftManagement: { team: Team & { role?: string } };
  Timesheet: { team: Team & { role?: string } };
  ShiftLocationManagement: { team: Team & { role?: string } };
  AreaRoleManagement: { team: Team & { role?: string } };
  ShiftCheckIn: { team: Team };
  CreateTeam: undefined;
  JoinTeam: { token?: string };
  RoleCreation: { team: Team; organizationId: string };
  RoleLevel: { team: Team; role: Role };
  PermissionAssignment: { team: Team; role: Role; roleLevel: RoleLevel };
  MemberRole: { team: Team; member: Member };
};

const Stack = createStackNavigator<TeamsStackParamList>();

const transitionSpec = {
  open: {
    animation: 'timing' as const,
    config: { duration: TRANSITION_DURATION, easing: Easing.out(Easing.ease) },
  },
  close: {
    animation: 'timing' as const,
    config: { duration: TRANSITION_DURATION, easing: Easing.inOut(Easing.ease) },
  },
};

const sharedScreenOptions = {
  cardStyle: { backgroundColor: colors.background },
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { ...typography.subtitle, color: colors.accent },
  headerTintColor: colors.textPrimary,
  headerShadowVisible: false,
  gestureEnabled: true,
};

export function TeamsStack() {
  return (
    <Stack.Navigator
      screenOptions={({ route }) => ({
        ...sharedScreenOptions,
        cardStyleInterpolator:
          route.name === 'TeamsList' ? undefined : CardStyleInterpolators.forVerticalIOS,
        transitionSpec: route.name === 'TeamsList' ? undefined : transitionSpec,
      })}
    >
      <Stack.Screen
        name="TeamsList"
        component={TeamsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: 'Takım' }} />
      <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ title: 'Ekip Yönetimi' }} />
      <Stack.Screen name="MemberProfile" component={MemberProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="ShiftManagement" component={ShiftManagementScreen} options={{ title: 'Vardiya Yönetimi' }} />
      <Stack.Screen name="Timesheet" component={TimesheetScreen} options={{ title: 'Puantaj Yönetimi' }} />
      <Stack.Screen name="ShiftLocationManagement" component={ShiftLocationManagementScreen} options={{ title: 'Vardiya Konum Yönetimi' }} />
      <Stack.Screen name="AreaRoleManagement" component={AreaRoleManagementScreen} options={{ title: 'Alan/Rol Yönetimi' }} />
      <Stack.Screen name="ShiftCheckIn" component={ShiftCheckInScreen} options={{ title: 'Vardiya girişi' }} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ title: 'Takım oluştur' }} />
      <Stack.Screen name="JoinTeam" component={JoinTeamInAppScreen} options={{ title: 'Takıma katıl' }} />
      <Stack.Screen name="RoleCreation" component={RoleCreationScreen} options={{ title: 'Rol oluştur' }} />
      <Stack.Screen name="RoleLevel" component={RoleLevelScreen} options={{ title: 'Rol seviyeleri' }} />
      <Stack.Screen name="PermissionAssignment" component={PermissionAssignmentScreen} options={{ title: 'Yetkiler' }} />
      <Stack.Screen name="MemberRole" component={MemberRoleScreen} options={{ title: 'Üye rolü' }} />
    </Stack.Navigator>
  );
}
