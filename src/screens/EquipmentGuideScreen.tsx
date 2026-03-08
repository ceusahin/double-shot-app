import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Card } from '../components';
import { colors, spacing, typography } from '../utils/theme';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_FAULTS, MAINTENANCE_TASKS, type FaultItem } from '../data/equipment';

export function EquipmentGuideScreen() {
  const [activeTab, setActiveTab] = useState<'troubleshoot' | 'maintenance'>('troubleshoot');
  const [selectedCategory, setSelectedCategory] = useState<string>('espresso');
  const [expandedFaultId, setExpandedFaultId] = useState<string | null>(null);

  const faults = EQUIPMENT_FAULTS[selectedCategory] ?? [];

  const severityText = (s: FaultItem['severity']) => {
    if (s === 'high') return 'Teknik Servis Gerekebilir (Acil)';
    if (s === 'medium') return 'Barista Müdahalesi (Orta)';
    return 'Barista Kontrolü (Hafif)';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Makine & <Text style={styles.titleAccent}>Ekipman</Text></Text>
        <Text style={styles.subtitle}>Sorun tespit, arıza onarım ve periyodik bakımlar.</Text>
      </View>

      <Card style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠</Text>
        <View style={styles.warningBody}>
          <Text style={styles.warningTitle}>Güvenlik Uyarısı</Text>
          <Text style={styles.warningText}>
            Elektrik veya yüksek basınçlı parçalara müdahale ederken her zaman cihazın kapalı/fişten çekili olduğundan emin olun. Ciddi arızalar için teknik servisi veya ekip liderini derhal bilgilendirin.
          </Text>
        </View>
      </Card>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'troubleshoot' && styles.tabActive]}
          onPress={() => setActiveTab('troubleshoot')}
        >
          <Text style={[styles.tabText, activeTab === 'troubleshoot' && styles.tabTextActive]}>Arıza Çözümü</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'maintenance' && styles.tabActive]}
          onPress={() => setActiveTab('maintenance')}
        >
          <Text style={[styles.tabText, activeTab === 'maintenance' && styles.tabTextActive]}>Bakım Takvimi</Text>
        </Pressable>
      </View>

      {activeTab === 'troubleshoot' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills} contentContainerStyle={styles.pillsContent}>
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.pill, selectedCategory === cat.id && styles.pillActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[styles.pillText, selectedCategory === cat.id && styles.pillTextActive]}>{cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Sık Karşılaşılan Sorunlar ({faults.length} kayıt)</Text>

          {faults.map((fault) => {
            const isExpanded = expandedFaultId === fault.id;
            return (
              <Card key={fault.id} style={[styles.faultCard, isExpanded && styles.faultCardExpanded]}>
                <Pressable style={styles.faultHeader} onPress={() => setExpandedFaultId(isExpanded ? null : fault.id)}>
                  <View style={styles.faultHeaderLeft}>
                    <Text style={[styles.faultTitle, isExpanded && styles.faultTitleAccent]}>{fault.title}</Text>
                    {!isExpanded && (
                      <Text style={styles.faultSeverity}>{severityText(fault.severity)}</Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>{isExpanded ? '▼' : '›'}</Text>
                </Pressable>
                {isExpanded && (
                  <View style={styles.faultBody}>
                    <View style={styles.symptomsBox}>
                      <Text style={styles.symptomsLabel}>SEMPTOMLAR</Text>
                      <Text style={styles.symptomsText}>"{fault.symptoms}"</Text>
                    </View>
                    <Text style={styles.solutionsLabel}>BARİSTA ÇÖZÜM ADIMLARI</Text>
                    {fault.solutions.map((sol, idx) => (
                      <Text key={idx} style={styles.solutionItem}>{idx + 1}. {sol}</Text>
                    ))}
                    {fault.severity === 'high' && (
                      <Pressable style={styles.serviceBtn}>
                        <Text style={styles.serviceBtnText}>Servis Yetkilisine Bildir</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}

      {activeTab === 'maintenance' && (
        <>
          <Text style={styles.maintenanceDesc}>
            Dükkanınızdaki standart bakım görevleri. Bu görevleri ekip lideriniz vardiya sonunda inceler.
          </Text>
          {MAINTENANCE_TASKS.map((task) => (
            <Card
              key={task.id}
              style={[styles.taskCard, task.status === 'done' && styles.taskCardDone]}
            >
              <View style={styles.taskLeft}>
                <Text style={[styles.taskTitle, task.status === 'done' && styles.taskTitleDone]}>{task.title}</Text>
                <View style={styles.taskPeriod}>
                  <Text style={styles.taskPeriodText}>{task.period}</Text>
                </View>
              </View>
              <View style={styles.taskRight}>
                {task.status === 'done' ? (
                  <Text style={styles.taskDone}>✓ Yapıldı</Text>
                ) : (
                  <View style={styles.taskTodo} />
                )}
              </View>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg },
  title: { ...typography.title, marginBottom: 4, color: colors.textPrimary },
  titleAccent: { color: colors.accent },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  warningIcon: { fontSize: 24, marginRight: spacing.md },
  warningBody: { flex: 1 },
  warningTitle: { fontSize: 14, marginBottom: 4, color: colors.textPrimary },
  warningText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surface, padding: 6, borderRadius: 24, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 16 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.black, fontWeight: '600' },
  pills: { marginBottom: spacing.md },
  pillsContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.surfaceLight, borderColor: colors.accent },
  pillText: { fontSize: 13, color: colors.textSecondary },
  pillTextActive: { color: colors.accent, fontWeight: '700' },
  sectionTitle: { fontSize: 15, marginBottom: spacing.md, color: colors.textPrimary },
  faultCard: { marginBottom: spacing.sm },
  faultCardExpanded: { borderColor: colors.accent, borderWidth: 1 },
  faultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faultHeaderLeft: { flex: 1, paddingRight: spacing.sm },
  faultTitle: { fontSize: 14, lineHeight: 20, marginBottom: 4, color: colors.textPrimary },
  faultTitleAccent: { color: colors.accent },
  faultSeverity: { fontSize: 11, color: colors.textSecondary },
  chevron: { color: colors.textSecondary, fontSize: 18 },
  faultBody: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  symptomsBox: { backgroundColor: colors.surfaceLight, padding: spacing.sm, borderRadius: 8, marginBottom: spacing.md },
  symptomsLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '700' },
  symptomsText: { fontSize: 13, lineHeight: 20, color: colors.textPrimary },
  solutionsLabel: { fontSize: 11, color: colors.accent, marginBottom: spacing.sm, fontWeight: '700' },
  solutionItem: { fontSize: 13, lineHeight: 22, color: colors.textPrimary, marginBottom: spacing.xs },
  serviceBtn: { marginTop: spacing.md, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: colors.error, borderRadius: 8, alignItems: 'center' },
  serviceBtnText: { fontSize: 13, fontWeight: '700', color: colors.error },
  maintenanceDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  taskCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.border },
  taskCardDone: { borderLeftColor: colors.accent, opacity: 0.7 },
  taskLeft: { flex: 1 },
  taskTitle: { fontSize: 14, marginBottom: 4, color: colors.textPrimary },
  taskTitleDone: { textDecorationLine: 'line-through' },
  taskPeriod: { alignSelf: 'flex-start' },
  taskPeriodText: { fontSize: 11, color: colors.textSecondary, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.surface, borderRadius: 4 },
  taskRight: {},
  taskDone: { fontSize: 12, color: colors.accent },
  taskTodo: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textSecondary, borderStyle: 'dashed' },
});
