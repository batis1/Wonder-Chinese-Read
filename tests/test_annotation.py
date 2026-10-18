import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from prepare import annotations, DATA
import jieba

class AnnotationRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lex=json.loads((DATA/'dictionary.json').read_text(encoding='utf-8'))
        cls.vocab=json.loads((DATA/'vocabulary.json').read_text(encoding='utf-8'))
        for word in cls.vocab:
            jieba.add_word(word,freq=max(jieba.get_FREQ(word) or 0,10))

    def tokens(self,text):
        return [t for p in annotations(text,self.lex,self.vocab) for s in p['sentences'] for t in s['tokens']]

    def test_time_phrase_is_not_sometimes(self):
        words=[t['text'] for t in self.tokens('如果今天有时间，我就去图书馆。')]
        self.assertIn('时间',words)
        self.assertNotIn('有时',words)

    def test_readings_for_neutral_syllables_and_modal_dei(self):
        tokens=self.tokens('妻子说，我们得听他的叙述。')
        byword={t['text']:t for t in tokens}
        self.assertEqual(byword['妻子']['pinyin'],'qīzi')
        self.assertEqual(byword['得']['pinyin'],'děi')

    def test_uploaded_text_keeps_unknown_words_unclassified(self):
        for token in self.tokens('今天学习中文。'):
            self.assertEqual(token['level'],self.vocab.get(token['text'],{}).get('level'))

    def test_consecutive_sentence_punctuation_is_preserved(self):
        text='真的吗？！我再想想……'
        self.assertEqual(''.join(t['text'] for t in self.tokens(text)),text)

if __name__=='__main__':
    unittest.main()
