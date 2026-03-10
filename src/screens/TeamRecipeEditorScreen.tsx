import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input } from '../components';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import {
  getTeamRecipe,
  createTeamRecipe,
  updateTeamRecipe,
  uploadRecipeImage,
} from '../services/teamRecipes';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';

type Nav = StackNavigationProp<RecipesStackParamList, 'TeamRecipeEditor'>;
type Route = RouteProp<RecipesStackParamList, 'TeamRecipeEditor'>;

export function TeamRecipeEditorScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { teamId, categoryId, recipeId } = route.params;
  const queryClient = useQueryClient();
  const isEdit = !!recipeId;

  const { data: existing } = useQuery({
    queryKey: ['team-recipe', recipeId],
    queryFn: () => getTeamRecipe(recipeId!),
    enabled: isEdit,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [steps, setSteps] = useState<string[]>(['']);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const stepYRef = useRef<Record<number, number>>({});

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || '');
      setIngredients(existing.ingredients?.length ? existing.ingredients : ['']);
      setSteps(existing.steps.length ? existing.steps : ['']);
      setImageUrl(existing.image_url || null);
    }
  }, [existing]);

  const addIngredient = () => setIngredients((s) => [...s, '']);
  const removeIngredient = (i: number) => setIngredients((s) => s.filter((_, idx) => idx !== i));
  const setIngredient = (i: number, value: string) =>
    setIngredients((s) => {
      const next = [...s];
      next[i] = value;
      return next;
    });
  const addStep = () => setSteps((s) => [...s, '']);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const setStep = (i: number, value: string) =>
    setSteps((s) => {
      const next = [...s];
      next[i] = value;
      return next;
    });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Fotoğraf seçmek için galeri izni gerekir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageUrl(null);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Eksik', 'Tarif adı girin.');
      return;
    }
    const cleanIngredients = ingredients.map((s) => s.trim()).filter(Boolean);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      if (isEdit) {
        await updateTeamRecipe(recipeId, {
          name: trimmedName,
          description: description.trim() || undefined,
          ingredients: cleanIngredients,
          steps: cleanSteps,
        });
        if (imageUri && imageBase64) {
          try {
            const url = await uploadRecipeImage(teamId, recipeId, imageUri, imageBase64);
            await updateTeamRecipe(recipeId, { image_url: url });
          } catch (imgErr) {
            Alert.alert('Fotoğraf yüklenemedi', imgErr instanceof Error ? imgErr.message : 'Tarif kaydedildi; fotoğrafı düzenleyerek tekrar deneyebilirsiniz.');
          }
        }
        queryClient.invalidateQueries({ queryKey: ['team-recipe', recipeId] });
        queryClient.invalidateQueries({ queryKey: ['team-recipes', teamId] });
      } else {
        const recipe = await createTeamRecipe(teamId, categoryId, {
          name: trimmedName,
          description: description.trim() || undefined,
          ingredients: cleanIngredients,
          steps: cleanSteps,
        });
        if (imageUri && imageBase64) {
          try {
            const url = await uploadRecipeImage(teamId, recipe.id, imageUri, imageBase64);
            await updateTeamRecipe(recipe.id, { image_url: url });
          } catch (imgErr) {
            Alert.alert(
              'Tarif kaydedildi',
              imgErr instanceof Error ? imgErr.message : 'Fotoğraf yüklenemedi. Tarifi düzenleyip daha küçük bir fotoğraf ekleyebilirsiniz.'
            );
          }
        } else if (imageUri && !imageBase64) {
          Alert.alert(
            'Tarif kaydedildi',
            'Fotoğraf boyutu büyük olduğu için yüklenemedi. Tarifi düzenleyip tekrar fotoğraf ekleyebilirsiniz (daha küçük bir fotoğraf seçin).'
          );
        }
        queryClient.invalidateQueries({ queryKey: ['team-recipes', teamId] });
      }
      queryClient.invalidateQueries({ queryKey: ['team-recipes', teamId, categoryId] });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const scrollToFocusedStep = (index: number) => {
    const y = stepYRef.current[index];
    if (y != null && scrollRef.current) {
      const offset = Math.max(0, y - 140);
      setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: true }), 100);
    } else if (keyboardHeight > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={colors.accent} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEdit ? 'Tarifi düzenle' : 'Yeni tarif'}</Text>
        </View>

        <Input label="Tarif adı" value={name} onChangeText={setName} placeholder="Örn: Soğuk Brew" />

        <Text style={styles.label}>Açıklama (isteğe bağlı)</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Kısa açıklama"
          multiline
          style={styles.descInput}
        />

        <Text style={styles.label}>Fotoğraf</Text>
        {(imageUri || imageUrl) ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: imageUri || imageUrl || undefined }} style={styles.previewImage} resizeMode="cover" />
            <Pressable style={styles.changePhotoBtn} onPress={pickImage}>
              <Text style={styles.changePhotoText}>Değiştir</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addPhotoBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={32} color={colors.accent} />
            <Text style={styles.addPhotoText}>Fotoğraf ekle</Text>
          </Pressable>
        )}

        <View style={styles.ingredientsHeader}>
          <Text style={styles.label}>Kullanılacak malzemeler</Text>
          <Pressable onPress={addIngredient} style={styles.addStepBtn}>
            <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
            <Text style={styles.addStepText}>Malzeme ekle</Text>
          </Pressable>
        </View>
        {ingredients.map((ing, i) => (
          <View key={`ing-${i}`} style={styles.stepRow}>
            <Text style={styles.stepNum}>•</Text>
            <Input
              value={ing}
              onChangeText={(v) => setIngredient(i, v)}
              placeholder="Malzeme adı veya miktarı"
              style={styles.stepInput}
            />
            {ingredients.length > 1 && (
              <Pressable onPress={() => removeIngredient(i)} style={styles.removeStepBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            )}
          </View>
        ))}

        <View style={styles.stepsHeader}>
          <Text style={styles.label}>Hazırlama adımları</Text>
          <Pressable onPress={addStep} style={styles.addStepBtn}>
            <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
            <Text style={styles.addStepText}>Adım ekle</Text>
          </Pressable>
        </View>
        {steps.map((step, i) => (
          <View
            key={i}
            style={styles.stepRow}
            onLayout={(e) => { stepYRef.current[i] = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.stepNum}>{i + 1}.</Text>
            <Input
              value={step}
              onChangeText={(v) => setStep(i, v)}
              placeholder={`Adım ${i + 1}`}
              style={styles.stepInput}
              onFocus={() => scrollToFocusedStep(i)}
            />
            {steps.length > 1 && (
              <Pressable onPress={() => removeStep(i)} style={styles.removeStepBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            )}
          </View>
        ))}

        <Button title={isEdit ? 'Kaydet' : 'Tarifi oluştur'} onPress={handleSave} loading={saving} style={styles.saveBtn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bgDark },
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '18',
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.semibold, color: colors.textPrimary, flex: 1 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  descInput: { minHeight: 80 },
  imageWrap: { marginBottom: spacing.sm },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: borderRadius.md, backgroundColor: colors.surface },
  changePhotoBtn: { marginTop: spacing.xs },
  changePhotoText: { fontSize: 14, color: colors.accent, fontFamily: fonts.medium },
  addPhotoBtn: {
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '0C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  addPhotoText: { fontSize: 14, color: colors.accent, marginTop: spacing.xs },
  ingredientsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  addStepBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addStepText: { fontSize: 14, color: colors.accent, fontFamily: fonts.medium },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stepNum: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary, minWidth: 24 },
  stepInput: { flex: 1 },
  removeStepBtn: { padding: spacing.xs },
  saveBtn: { marginTop: spacing.xl },
});
