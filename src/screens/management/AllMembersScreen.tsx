import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Pressable,
  ScrollView,
  ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components';
import {
  listAllUsersForPlatformStaff,
  countTeamMembershipsByUserIds,
  countOwnedTeamsByUserIds,
  sumQuotaBalances,
} from '../../services/platformAdmin';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../../utils/theme';
import type { TeamsStackParamList } from '../../navigation/TeamsStack';
import { useMainTabScrollPadding } from '../../hooks/useMainTabScrollPadding';
import type { UserProfile } from '../../types';

type Nav = StackNavigationProp<TeamsStackParamList, 'AllMembers'>;

type Row = UserProfile & { teamCount: number; ownedTeamCount: number };

function ListHeader({
  query,
  setQuery,
  rowCount,
  filteredCount,
  insetsTop,
}: {
  query: string;
  setQuery: (q: string) => void;
  rowCount: number;
  filteredCount: number;
  insetsTop: number;
}) {
  return (
    <View style={styles.headerBlock}>
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.22)', 'rgba(10, 10, 10, 0.35)', colors.bgDark]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.heroGradient,
          {
            marginHorizontal: -spacing.md,
            paddingTop: insetsTop + spacing.md,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.heroIconBadge}>
          <Ionicons name="person-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.heroEyebrow}>Kullanıcılar</Text>
        <Text style={styles.heroTitle}>
          Tüm <Text style={styles.heroTitleAccent}>üyeler</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Kayıtlı kullanıcıları arayın; süper yönetici olarak kota ve paket sürelerini detaylı yönetin.
        </Text>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="İsim veya e-posta ara"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <Text style={styles.countHint}>
        {filteredCount === rowCount
          ? `${rowCount} kayıtlı kullanıcı`
          : `${filteredCount} sonuç (${rowCount} toplam)`}
      </Text>
      <Text style={styles.listEyebrow}>Kayıtlı kullanıcılar</Text>
    </View>
  );
}

export function AllMembersScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const navigation = useNavigation<Nav>();
  const viewer = useAuthStore((s) => s.user);
  const viewerIsSuper = !!viewer?.is_super_admin;
  const [query, setQuery] = useState('');

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ['management-all-users'],
    queryFn: async (): Promise<Row[]> => {
      const users = await listAllUsersForPlatformStaff();
      const visible = users.filter((u) => !u.is_super_admin);
      const ids = visible.map((u) => u.id);
      const memberCounts = await countTeamMembershipsByUserIds(ids);
      const ownedCounts = await countOwnedTeamsByUserIds(ids);
      return visible.map((u) => ({
        ...u,
        teamCount: memberCounts.get(u.id) ?? 0,
        ownedTeamCount: ownedCounts.get(u.id) ?? 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) => {
      const name = `${u.name} ${u.surname}`.trim().toLowerCase();
      return name.includes(q) || (u.email?.toLowerCase().includes(q) ?? false);
    });
  }, [rows, query]);

  const openDetail = useCallback(
    (u: UserProfile) => {
      if (viewerIsSuper) {
        navigation.navigate('SuperAdminUserDetail', { user: u });
      } else {
        navigation.navigate('MemberProfile', { user: u });
      }
    },
    [navigation, viewerIsSuper]
  );

  const listHeader = useMemo(
    () => (
      <ListHeader
        query={query}
        setQuery={setQuery}
        rowCount={rows.length}
        filteredCount={filtered.length}
        insetsTop={insets.top}
      />
    ),
    [query, rows.length, filtered.length, insets.top]
  );

  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item }) => {
      const displayName = [item.name, item.surname].filter(Boolean).join(' ') || item.email || '—';
      const targetIsPlatformAdmin = !!item.is_platform_admin;
      const totalQuota = sumQuotaBalances(item);

      return (
        <View style={styles.rowPanel}>
          <View style={styles.panelGoldCap} />
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <Pressable
            style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressPressed]}
            onPress={() => openDetail(item)}
          >
            <Avatar source={item.profile_photo} name={displayName} size={52} style={styles.avatar} />
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                {targetIsPlatformAdmin ? (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-outline" size={10} color={colors.accent} />
                    <Text style={styles.adminBadgeText}>YÖNETİCİ</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.email} numberOfLines={1}>
                {item.email}
              </Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Ionicons name="people-outline" size={11} color={colors.textMuted} />
                  <Text style={styles.chipText}>
                    {item.ownedTeamCount} sahip
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="person-circle-outline" size={11} color={colors.textMuted} />
                  <Text style={styles.chipText}>
                    {item.teamCount} üyelik
                  </Text>
                </View>
                {viewerIsSuper && !targetIsPlatformAdmin ? (
                  <View
                    style={[
                      styles.chip,
                      totalQuota > 0 ? styles.chipAccent : styles.chipMuted,
                    ]}
                  >
                    <Ionicons
                      name="ticket-outline"
                      size={11}
                      color={totalQuota > 0 ? colors.accent : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        totalQuota > 0 ? styles.chipTextAccent : undefined,
                      ]}
                    >
                      {totalQuota} kota
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      );
    },
    [openDetail, viewerIsSuper]
  );

  const heroOnly = (
    <LinearGradient
      colors={['rgba(212, 175, 55, 0.22)', 'rgba(10, 10, 10, 0.35)', colors.bgDark]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[
        styles.heroGradient,
        {
          marginHorizontal: -spacing.md,
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View style={styles.heroIconBadge}>
        <Ionicons name="person-outline" size={22} color={colors.accent} />
      </View>
      <Text style={styles.heroEyebrow}>Kullanıcılar</Text>
      <Text style={styles.heroTitle}>
        Tüm <Text style={styles.heroTitleAccent}>üyeler</Text>
      </Text>
      <Text style={styles.heroSubtitle}>
        Kayıtlı kullanıcıları arayın; süper yönetici olarak kota ve paket sürelerini detaylı yönetin.
      </Text>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabScrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {heroOnly}
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Kullanıcılar yükleniyor…</Text>
        </View>
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabScrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {heroOnly}
        <View style={styles.errorPanel}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Liste yüklenemedi.'}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabScrollBottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query.trim() ? 'Aramanızla eşleşen kullanıcı yok.' : 'Kayıtlı kullanıcı yok.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  listEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  scrollContent: { paddingHorizontal: spacing.md },
  headerBlock: { marginBottom: 0 },
  heroGradient: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTitleAccent: { color: colors.accent },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: '98%',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    backgroundColor: colors.glassBg,
    ...shadow.sm,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  countHint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 0 },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    ...shadow.sm,
  },
  loadingText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  errorPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(233, 196, 106, 0.35)',
    backgroundColor: 'rgba(233, 196, 106, 0.08)',
  },
  errorText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 22 },
  rowPanel: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  panelGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  rowPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowPressPressed: { opacity: 0.9 },
  avatar: { flexShrink: 0 },
  rowText: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: { ...typography.subtitle, color: colors.textPrimary, flexShrink: 1 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  adminBadgeText: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  email: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  chipAccent: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  chipMuted: {
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  chipText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
  },
  chipTextAccent: { color: colors.accent },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
