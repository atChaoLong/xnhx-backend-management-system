-- 面试维度字典：亲和力、礼貌着装/精神面貌、逻辑表达能力、课件准备充分度
DO $$
BEGIN
  -- 共用等级选项：强、较强、一般、较弱、未评
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('affinity_level', 'strong', '强', 1, true),
    ('affinity_level', 'good', '较强', 2, true),
    ('affinity_level', 'average', '一般', 3, true),
    ('affinity_level', 'weak', '较弱', 4, true),
    ('affinity_level', 'none', '未评', 5, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('dress_appearance_level', 'strong', '强', 1, true),
    ('dress_appearance_level', 'good', '较强', 2, true),
    ('dress_appearance_level', 'average', '一般', 3, true),
    ('dress_appearance_level', 'weak', '较弱', 4, true),
    ('dress_appearance_level', 'none', '未评', 5, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('logical_expression_level', 'strong', '强', 1, true),
    ('logical_expression_level', 'good', '较强', 2, true),
    ('logical_expression_level', 'average', '一般', 3, true),
    ('logical_expression_level', 'weak', '较弱', 4, true),
    ('logical_expression_level', 'none', '未评', 5, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('material_preparation_level', 'strong', '强', 1, true),
    ('material_preparation_level', 'good', '较强', 2, true),
    ('material_preparation_level', 'average', '一般', 3, true),
    ('material_preparation_level', 'weak', '较弱', 4, true),
    ('material_preparation_level', 'none', '未评', 5, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;
END $$;

