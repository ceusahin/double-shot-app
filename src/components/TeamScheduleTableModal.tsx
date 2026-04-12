import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { forcePortraitLock, setTeamScheduleFullscreenOpen } from '../services/appOrientation';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, borderRadius, fonts, typography } from '../utils/theme';
import { getCalendarColumnBusinessKey, getTimestampBusinessDateKey } from '../utils/businessDay';
import {
  buildOrgRoleByUserId,
  resolveShiftRoleLabel,
  teamMemberRoleToStoredShiftRole,
} from '../utils/shiftRoleLabel';
import { getTeamShiftTemplates, createShiftFromTemplate, deleteShift } from '../services/shifts';
import { listMembersWithRoles } from '../services/rbac';
import type { Shift, ShiftTemplate } from '../types';
import type { TeamMember } from '../types';

const DAY_HEADERS_TR = [
  'PAZARTESİ',
  'SALI',
  'ÇARŞAMBA',
  'PERŞEMBE',
  'CUMA',
  'CUMARTESİ',
  'PAZAR',
] as const;

/** Köşe + sol çalışan adı sütunu */
const CORNER_W = 132;
const CELL_H = 78;
const HEADER_H = 62;
const DAY_COL_COUNT = 7;

export interface TeamScheduleTableModalProps {
  visible: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  teamOwnerId: string;
  organizationId: string | null | undefined;
  weekRangeLabel: string;
  weekDays: Date[];
  shifts: (Shift & { user?: { name?: string; surname?: string } })[];
  members: TeamMember[];
  businessDateKey: string;
  shiftsLoading: boolean;
  canEditSchedule: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
}

type TeamScheduleTableModalImplProps = TeamScheduleTableModalProps & {
  registerHardwareBack: React.MutableRefObject<() => void>;
};

/** Tam ekran Modal ayrı pencerede; inset’ler ana SafeAreaProvider’dan yanlış gelebilir. */
export function TeamScheduleTableModal(props: TeamScheduleTableModalProps) {
  const hardwareBackRef = React.useRef<() => void>(() => {
    void forcePortraitLock();
    props.onClose();
  });

  return (
    <Modal
      visible={props.visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => hardwareBackRef.current()}
    >
      <SafeAreaProvider>
        <TeamScheduleTableModalImpl {...props} registerHardwareBack={hardwareBackRef} />
      </SafeAreaProvider>
    </Modal>
  );
}

function TeamScheduleTableModalImpl({
  registerHardwareBack,
  visible,
  onClose,
  teamId,
  teamName,
  teamOwnerId,
  organizationId,
  weekRangeLabel,
  weekDays,
  shifts,
  members,
  businessDateKey,
  shiftsLoading,
  canEditSchedule,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
}: TeamScheduleTableModalImplProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const queryClient = useQueryClient();
  const [measuredTableW, setMeasuredTableW] = React.useState(0);
  const [captureBusy, setCaptureBusy] = useState(false);
  const scheduleTableCaptureRef = React.useRef<ScrollView>(null);

  const [assignTarget, setAssignTarget] = useState<{
    dayIndex: number;
    member: TeamMember;
  } | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['shift-templates', teamId],
    queryFn: () => getTeamShiftTemplates(teamId),
    enabled: visible && !!teamId,
  });

  const { data: orgMembersWithRoles = [] } = useQuery({
    queryKey: ['org-members-with-roles', organizationId],
    queryFn: () => listMembersWithRoles(organizationId!),
    enabled: visible && !!organizationId,
  });

  const rbacRoleByUserId = React.useMemo(
    () => buildOrgRoleByUserId(orgMembersWithRoles),
    [orgMembersWithRoles]
  );

  const lockLandscape = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch {
      /* ignore */
    }
  }, []);

  const restorePortrait = useCallback(() => {
    void forcePortraitLock();
  }, []);

  useEffect(() => {
    if (!visible) {
      setTeamScheduleFullscreenOpen(false);
      return;
    }
    setTeamScheduleFullscreenOpen(true);
    void lockLandscape();
    return () => {
      setTeamScheduleFullscreenOpen(false);
      void restorePortrait();
    };
  }, [visible, lockLandscape, restorePortrait]);

  /** Döndürmede boyut değişince portrait kilidi / sistem tekrar dikeye çekmesin diye yatayı yenile. */
  useEffect(() => {
    if (!visible) return;
    void lockLandscape();
  }, [visible, width, height, lockLandscape]);

  useEffect(() => {
    if (!visible) setAssignTarget(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) setMeasuredTableW(0);
  }, [visible]);

  const handleClose = useCallback(() => {
    setAssignTarget(null);
    setTeamScheduleFullscreenOpen(false);
    void forcePortraitLock();
    onClose();
  }, [onClose]);

  useEffect(() => {
    registerHardwareBack.current = handleClose;
  }, [handleClose, registerHardwareBack]);

  const colKeys = weekDays.map((d) => getCalendarColumnBusinessKey(d));

  const rootPadH = Math.max(insets.left, spacing.md) + Math.max(insets.right, spacing.md);

  /**
   * Başlık + gövde aynı genişlikte olmalı. İki ScrollView / sağ panel onLayout RN’de sık kaydırır.
   * Tek ölçüm: tableArea genişliği (padding sonrası gerçek alan).
   * onLayout öncesi: window genişliği − kök yatay padding (spacing.md*2 yanlış; çentikte taşma yapar).
   */
  const tableInnerW =
    measuredTableW > 0
      ? measuredTableW
      : Math.max(200, Math.floor(width - rootPadH));

  const rightBandW = Math.max(80, tableInnerW - CORNER_W - spacing.xs);

  const dayCellWidths = React.useMemo(() => {
    const gapTotal = spacing.xs * (DAY_COL_COUNT - 1);
    const inner = Math.max(0, rightBandW - gapTotal);
    const base = Math.floor(inner / DAY_COL_COUNT);
    const remainder = inner - base * DAY_COL_COUNT;
    const widths: number[] = [];
    for (let i = 0; i < DAY_COL_COUNT; i++) {
      widths.push(base + (i === DAY_COL_COUNT - 1 ? remainder : 0));
    }
    return widths;
  }, [rightBandW]);

  const rowBandWidth = React.useMemo(() => {
    const gapTotal = spacing.xs * (DAY_COL_COUNT - 1);
    return dayCellWidths.reduce((a, b) => a + b, 0) + gapTotal;
  }, [dayCellWidths]);

  const templateById = React.useMemo(
    () => Object.fromEntries(templates.map((t) => [t.id, t])) as Record<string, ShiftTemplate>,
    [templates]
  );

  /** businessDateKey → user_id → o gün o çalışana atanmış vardiya kayıtları */
  const shiftsByDayAndUser = React.useMemo(() => {
    const map: Record<string, Record<string, (typeof shifts)[number][]>> = {};
    for (const ck of colKeys) {
      map[ck] = {};
    }
    for (const s of shifts) {
      const ck = getTimestampBusinessDateKey(s.start_time);
      const uid = s.user_id;
      if (!map[ck]) continue;
      if (!map[ck][uid]) map[ck][uid] = [];
      map[ck][uid].push(s);
    }
    return map;
  }, [shifts, colKeys]);

  const invalidateShifts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['team-shifts', teamId] });
    queryClient.invalidateQueries({ queryKey: ['my-shifts-today'] });
  }, [queryClient, teamId]);

  const assignMutation = useMutation({
    mutationFn: async (vars: { userId: string; dayIndex: number; template: ShiftTemplate }) => {
      const member = members.find((m) => m.user_id === vars.userId);
      const roleLabel = teamMemberRoleToStoredShiftRole(
        member?.role,
        vars.userId,
        teamOwnerId,
        rbacRoleByUserId[vars.userId]
      );
      await createShiftFromTemplate(
        teamId,
        vars.template.id,
        vars.userId,
        weekDays[vars.dayIndex],
        roleLabel
      );
    },
    onSuccess: () => {
      invalidateShifts();
      setAssignTarget(null);
    },
    onError: (e) => {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Atama yapılamadı.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (shiftId: string) => deleteShift(shiftId),
    onSuccess: () => invalidateShifts(),
    onError: (e) => {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya silinemedi.');
    },
  });

  const sortedMembers = React.useMemo(() => {
    return [...members].sort((a, b) => {
      const na = [a.user?.name, a.user?.surname].filter(Boolean).join(' ') || a.user?.email || '';
      const nb = [b.user?.name, b.user?.surname].filter(Boolean).join(' ') || b.user?.email || '';
      return na.localeCompare(nb, 'tr');
    });
  }, [members]);

  const displayName = (m: TeamMember) =>
    [m.user?.name, m.user?.surname].filter(Boolean).join(' ') || m.user?.email || 'Üye';

  const loading = shiftsLoading || templatesLoading;

  const cellShifts =
    assignTarget != null
      ? shiftsByDayAndUser[colKeys[assignTarget.dayIndex]]?.[assignTarget.member.user_id] ?? []
      : [];

  const assignableTemplates = templates.filter(
    (t) => !cellShifts.some((s) => s.shift_template_id === t.id)
  );

  const scheduleTableReady = !loading && templates.length > 0 && sortedMembers.length > 0;

  const handleExportScheduleImage = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Desteklenmiyor', 'Bu özellik web sürümünde kullanılamaz.');
      return;
    }
    if (!scheduleTableCaptureRef.current || captureBusy) return;
    setCaptureBusy(true);
    try {
      await new Promise<void>((r) => setTimeout(r, 120));
      const uri = await captureRef(scheduleTableCaptureRef, {
        format: 'png',
        quality: 0.92,
        result: 'tmpfile',
        snapshotContentContainer: true,
      });
      const shareAvailable = await Sharing.isAvailableAsync();

      const runShare = () =>
        shareAvailable
          ? Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: `${teamName} · ${weekRangeLabel}`.slice(0, 120),
            })
          : Promise.resolve();

      Alert.alert('Program görüntüsü hazır', 'WhatsApp veya diğer uygulamalarla paylaşın; isterseniz galeriye kaydedin.', [
        { text: 'İptal', style: 'cancel' },
        ...(shareAvailable ? [{ text: 'Paylaş', onPress: () => void runShare() }] : []),
        {
          text: 'Galeriye kaydet',
          onPress: async () => {
            try {
              const { granted } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
              if (!granted) {
                Alert.alert('İzin gerekli', 'Kaydetmek için fotoğraf galerisi iznine ihtiyaç var.');
                return;
              }
              await MediaLibrary.saveToLibraryAsync(uri);
              Alert.alert('Tamam', 'Görüntü galeriye kaydedildi.');
            } catch (err) {
              Alert.alert('Hata', err instanceof Error ? err.message : 'Kayıt başarısız.');
            }
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Görüntü alınamadı.');
    } finally {
      setCaptureBusy(false);
    }
  }, [captureBusy, teamName, weekRangeLabel]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingLeft: Math.max(insets.left, spacing.md),
          paddingRight: Math.max(insets.right, spacing.md),
        },
      ]}
    >
        <View style={styles.topBar}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={styles.teamNameSmall} numberOfLines={1}>
              {teamName}
            </Text>
            <View style={styles.weekNavInline}>
              <Pressable onPress={onPrevWeek} style={styles.weekNavIcon} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={colors.accent} />
              </Pressable>
              <Text style={styles.weekRangeTitle} numberOfLines={1}>
                {weekRangeLabel}
              </Text>
              <Pressable onPress={onNextWeek} style={styles.weekNavIcon} hitSlop={10}>
                <Ionicons name="chevron-forward" size={22} color={colors.accent} />
              </Pressable>
            </View>
          </View>
          <View style={styles.topBarRight}>
            {scheduleTableReady ? (
              <Pressable
                onPress={() => void handleExportScheduleImage()}
                disabled={captureBusy}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Programı resim olarak paylaş veya kaydet"
              >
                {captureBusy ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="share-outline" size={24} color={colors.accent} />
                )}
              </Pressable>
            ) : null}
            <Pressable
              onPress={onThisWeek}
              style={({ pressed }) => [styles.thisWeekBtn, pressed && styles.iconBtnPressed]}
              hitSlop={8}
            >
              <Ionicons name="today-outline" size={22} color={colors.accent} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Program yükleniyor…</Text>
          </View>
        ) : templates.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Vardiya tanımı yok</Text>
            <Text style={styles.emptySub}>
              Satırlar ekip liderinin oluşturduğu vardiya şablonlarından gelir. Önce Vardiya yönetiminden
              tanım ekleyin.
            </Text>
          </View>
        ) : sortedMembers.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Ekipte üye yok</Text>
            <Text style={styles.emptySub}>
              Tam ekran programa çalışan satırları için önce ekibe üye ekleyin.
            </Text>
          </View>
        ) : (
          <View
            style={styles.tableArea}
            collapsable={false}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (w > 0) setMeasuredTableW((prev) => (prev !== w ? w : prev));
            }}
          >
            <ScrollView
              ref={scheduleTableCaptureRef}
              stickyHeaderIndices={[0]}
              style={styles.tableBodyScroll}
              showsVerticalScrollIndicator
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              contentContainerStyle={[
                styles.tableBodyScrollContent,
                { width: tableInnerW },
              ]}
            >
              <View
                style={[
                  styles.scheduleStickyHeader,
                  { height: HEADER_H, width: tableInnerW, minWidth: tableInnerW },
                ]}
                collapsable={false}
              >
                {/* Yapışkan başlık: flexDirection iç View’da (Android’de dış sarmalayıcı satır stilini düşürebiliyor). */}
                <View style={styles.scheduleHeaderInnerRow}>
                  <LinearGradient
                    colors={['#9A7827', colors.accent, '#E8C547']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.cornerHeader, styles.headerCellRadius]}
                  >
                    <Text style={styles.headerCellText}>ÇALIŞAN / GÜN</Text>
                  </LinearGradient>
                  <View style={[styles.scrollDaysRow, { width: rowBandWidth }]}>
                  {weekDays.map((day, dayIndex) => {
                    const ck = colKeys[dayIndex];
                    const isTodayCol = ck === businessDateKey;
                    const cellW = dayCellWidths[dayIndex] ?? 40;
                    return (
                      <LinearGradient
                        key={ck}
                        colors={['#9A7827', colors.accent, '#E8C547']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={[
                          styles.headerCellRadius,
                          {
                            width: cellW,
                            minWidth: cellW,
                            maxWidth: cellW,
                            height: HEADER_H,
                          },
                          isTodayCol && styles.dayColumnHeaderToday,
                        ]}
                      >
                        <Text style={styles.templateHeaderName} numberOfLines={1} adjustsFontSizeToFit>
                          {DAY_HEADERS_TR[dayIndex]}
                        </Text>
                        <Text style={styles.templateHeaderTime}>{day.getDate()}</Text>
                        {isTodayCol ? (
                          <Text style={styles.dayHeaderTodayTag}>Bugün</Text>
                        ) : null}
                      </LinearGradient>
                    );
                  })}
                  </View>
                </View>
              </View>

              {sortedMembers.map((m) => (
                <View key={m.id} style={[styles.unifiedDataRow, { width: tableInnerW }]}>
                  <LinearGradient
                    colors={['#9A7827', colors.accent, '#E8C547']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.headerCellRadius, styles.shiftLabelCell]}
                  >
                    <Text style={styles.memberRowName} numberOfLines={2}>
                      {displayName(m).toLocaleUpperCase('tr-TR')}
                    </Text>
                    <Text style={styles.memberRowRole} numberOfLines={2}>
                      {resolveShiftRoleLabel(
                        m.user_id,
                        teamOwnerId,
                        members,
                        null,
                        rbacRoleByUserId[m.user_id]
                      ).toLocaleUpperCase('tr-TR')}
                    </Text>
                  </LinearGradient>
                  <View style={[styles.scrollDaysRow, { width: rowBandWidth }]}>
                    {weekDays.map((day, dayIndex) => {
                      const ck = colKeys[dayIndex];
                      const isTodayCol = ck === businessDateKey;
                      const list = shiftsByDayAndUser[ck]?.[m.user_id] ?? [];
                      const cellW = dayCellWidths[dayIndex] ?? 40;
                      return (
                        <Pressable
                          key={`${m.id}-${dayIndex}`}
                          onPress={() => {
                            if (canEditSchedule) setAssignTarget({ dayIndex, member: m });
                          }}
                          disabled={!canEditSchedule}
                          style={({ pressed }) => [
                            styles.dataCellFixed,
                            { width: cellW, minWidth: cellW, maxWidth: cellW },
                            styles.bodyCell,
                            isTodayCol && styles.dataCellToday,
                            list.length === 0 && styles.dataCellOff,
                            pressed && canEditSchedule && styles.dataCellPressed,
                          ]}
                        >
                          {list.length === 0 ? (
                            <View style={styles.cellOffBadge}>
                              <Text style={styles.cellEmpty}>OFF</Text>
                            </View>
                          ) : (
                            <View style={styles.cellNames}>
                              {list.map((s) => {
                                const tpl =
                                  s.shift_template_id != null
                                    ? templateById[s.shift_template_id]
                                    : undefined;
                                return (
                                  <View key={s.id} style={styles.cellShiftBlock}>
                                    <Text style={styles.cellShiftName} numberOfLines={2}>
                                      {tpl?.name ?? 'Vardiya'}
                                    </Text>
                                    {tpl ? (
                                      <Text style={styles.cellShiftTime} numberOfLines={1}>
                                        {tpl.start_time.slice(0, 5)} – {tpl.end_time.slice(0, 5)}
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

      <Modal
        visible={assignTarget != null}
        animationType={isLandscape ? 'fade' : 'slide'}
        transparent
        onRequestClose={() => setAssignTarget(null)}
      >
        <View
          style={[
            styles.assignOverlay,
            isLandscape && styles.assignOverlayLandscape,
            { width: '100%', minHeight: height },
          ]}
        >
          <Pressable style={styles.assignBackdrop} onPress={() => setAssignTarget(null)} />
          <View
            style={[
              styles.assignSheet,
              !isLandscape && styles.assignSheetPortrait,
              isLandscape && styles.assignSheetLandscape,
              isLandscape && {
                width: Math.min(Math.round(width * 0.52), 560),
                height: Math.min(
                  Math.round(height * 0.9),
                  Math.round(height - insets.top - insets.bottom - spacing.md * 2)
                ),
              },
            ]}
          >
            <View style={styles.assignHeader}>
              <Text style={styles.assignTitle} numberOfLines={3}>
                {assignTarget
                  ? `${displayName(assignTarget.member)} · ${weekDays[assignTarget.dayIndex].toLocaleDateString('tr-TR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}`
                  : ''}
              </Text>
              <Pressable onPress={() => setAssignTarget(null)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={[
                styles.assignList,
                isLandscape ? styles.assignListLandscape : { maxHeight: Math.min(360, Math.floor(height * 0.42)) },
              ]}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.assignListContent}
              showsVerticalScrollIndicator
            >
              {cellShifts.length > 0 ? (
                <>
                  <Text style={styles.assignSectionLabel}>Bu güne atanmış vardiyalar</Text>
                  {cellShifts.map((s) => {
                    const tpl =
                      s.shift_template_id != null ? templateById[s.shift_template_id] : undefined;
                    return (
                      <View key={s.id} style={styles.assignRow}>
                        <View style={styles.assignShiftRowText}>
                          <Text style={styles.assignRowName} numberOfLines={1}>
                            {tpl?.name ?? 'Vardiya'}
                          </Text>
                          {tpl ? (
                            <Text style={styles.assignShiftRowMeta} numberOfLines={1}>
                              {tpl.start_time.slice(0, 5)} – {tpl.end_time.slice(0, 5)}
                            </Text>
                          ) : null}
                        </View>
                        {canEditSchedule ? (
                          <Pressable
                            onPress={() => {
                              Alert.alert('Vardiyayı kaldır', 'Bu atamayı silmek istiyor musunuz?', [
                                { text: 'İptal', style: 'cancel' },
                                {
                                  text: 'Sil',
                                  style: 'destructive',
                                  onPress: () => deleteMutation.mutate(s.id),
                                },
                              ]);
                            }}
                            hitSlop={8}
                          >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              ) : null}

              <Text style={styles.assignSectionLabel}>Vardiya ata</Text>
              {assignableTemplates.length === 0 ? (
                <Text style={styles.assignEmpty}>
                  {cellShifts.length > 0
                    ? 'Bu güne eklenebilecek başka vardiya tanımı kalmadı.'
                    : 'Atanacak vardiya tanımı yok.'}
                </Text>
              ) : (
                assignableTemplates.map((t) => (
                  <Pressable
                    key={t.id}
                    style={({ pressed }) => [styles.assignMemberRow, pressed && styles.assignMemberRowPressed]}
                    onPress={() => {
                      if (!assignTarget) return;
                      assignMutation.mutate({
                        userId: assignTarget.member.user_id,
                        dayIndex: assignTarget.dayIndex,
                        template: t,
                      });
                    }}
                    disabled={assignMutation.isPending}
                  >
                    <View style={styles.assignTemplateTextCol}>
                      <Text style={styles.assignMemberName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={styles.assignTemplateMeta} numberOfLines={1}>
                        {t.start_time.slice(0, 5)} – {t.end_time.slice(0, 5)}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: spacing.xs },
  iconBtnPressed: { opacity: 0.75 },
  topBarCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  teamNameSmall: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  weekNavInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekNavIcon: { padding: 4 },
  weekRangeTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
  },
  thisWeekBtn: { padding: spacing.xs },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadingText: { color: colors.textSecondary, fontFamily: fonts.regular },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  tableArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  tableBodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  tableBodyScrollContent: {
    paddingBottom: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  /** Tek ScrollView: çalışan etiketi + gün hücreleri aynı satırda (RN kayma bug’u yok) */
  unifiedDataRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    minHeight: CELL_H,
    gap: spacing.xs,
  },
  scrollDaysRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    gap: spacing.xs,
  },
  scheduleStickyHeader: {
    backgroundColor: colors.bgDark,
    zIndex: 2,
    ...(Platform.OS === 'android' ? { elevation: 6 } : null),
  },
  scheduleHeaderInnerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    width: '100%',
    gap: spacing.xs,
  },
  headerCellRadius: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  cornerHeader: {
    width: CORNER_W,
    height: HEADER_H,
    flexShrink: 0,
  },
  dayColumnHeaderToday: {
    borderWidth: 2,
    borderColor: colors.bgDark,
  },
  dayHeaderTodayTag: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    marginTop: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  /** Gövde: sol sütun — çalışan adı, gün başlıklarıyla aynı gradient */
  shiftLabelCell: {
    width: CORNER_W,
    minHeight: CELL_H,
    flexShrink: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  headerCellText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  templateHeaderName: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
  },
  templateHeaderTime: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    marginTop: 3,
    textAlign: 'center',
    width: '100%',
  },
  bodyCell: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '45',
    backgroundColor: colors.surface,
  },
  dayLabelCell: {
    width: CORNER_W,
    height: CELL_H,
    padding: spacing.xs,
    justifyContent: 'center',
  },
  dayLabelToday: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '14',
  },
  dayLabelText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  dayDateNum: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  dayTodayTag: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.accent,
    marginTop: 2,
  },
  /** Genişlik satır içinde piksel olarak verilir (ScrollView + Pressable flex hatası yok) */
  dataCellFixed: {
    minHeight: CELL_H,
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  dataCellToday: {
    backgroundColor: colors.accent + '0C',
    borderColor: colors.accent + '80',
  },
  /** Vardiya yok — OFF hücresi (bodyCell üzerine biner, bugün sütunundan sonra gelir) */
  dataCellOff: {
    borderWidth: 1.5,
  },
  dataCellPressed: { opacity: 0.88 },
  cellOffBadge: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
  },
  cellEmpty: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  cellNames: { gap: 2, width: '100%', alignItems: 'stretch' },
  cellNameText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  memberRowName: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.2,
  },
  memberRowRole: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    opacity: 0.92,
    textAlign: 'center',
    width: '100%',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  cellShiftBlock: { width: '100%', alignItems: 'stretch', gap: 2 },
  cellShiftName: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cellShiftTime: {
    fontSize: 9,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  assignOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  assignOverlayLandscape: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  assignBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  assignSheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    zIndex: 2,
    flexDirection: 'column',
  },
  assignSheetPortrait: {
    maxHeight: '78%',
    width: '100%',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  assignSheetLandscape: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  assignHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  assignTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  assignSectionLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  assignShiftRowText: { flex: 1, minWidth: 0 },
  assignRowName: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
  },
  assignShiftRowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  assignList: { minHeight: 0 },
  assignListLandscape: {
    flex: 1,
  },
  assignListContent: {
    flexGrow: 1,
    paddingBottom: spacing.sm,
  },
  assignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.bgDark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignMemberRowPressed: { opacity: 0.85 },
  assignMemberName: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  assignTemplateTextCol: { flex: 1, minWidth: 0 },
  assignTemplateMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  assignEmpty: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: spacing.md,
  },
});
