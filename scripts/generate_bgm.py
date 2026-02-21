import math
import struct
import wave
import random

SAMPLE_RATE = 44100
AMPLITUDE = 8000
def get_freq(note_name):
    if note_name == 0: return 0
    note_map = {'C':-9, 'Db':-8, 'D':-7, 'Eb':-6, 'E':-5, 'F':-4, 'Gb':-3, 'G':-2, 'Ab':-1, 'A':0, 'Bb':1, 'B':2}
    name = note_name[:-1]
    octave = int(note_name[-1])
    semitones = note_map[name] + (octave - 4) * 12
    return 440.0 * (2.0 ** (semitones / 12.0))

def generate_square_wave(freq, duration, vol=1.0, decay=True):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    if freq == 0: return [0] * num_samples
        
    for i in range(num_samples):
        t = float(i) / SAMPLE_RATE
        env = 1.0
        if decay:
            if t > 0.05: env = max(0, math.exp(-15 * (t - 0.05)))
        else:
            env = max(0, 1.0 - (t / duration) * 0.2)
            if i > num_samples - 500: env *= (num_samples - i) / 500.0
                
        val = 1.0 if math.sin(2 * math.pi * freq * t) > 0 else -1.0
        samples.append(int(val * AMPLITUDE * vol * env))
    return samples

def generate_noise(duration, vol=0.5):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(num_samples):
        t = float(i) / SAMPLE_RATE
        env = max(0, math.exp(-30 * t))
        val = random.uniform(-1, 1)
        samples.append(int(val * AMPLITUDE * vol * env))
    return samples

def write_wav(filename, bpm, duration, base_pattern, arpeggio_pattern, complexity=1, intensity=1.0, is_boss=False):
    beat_dur = 60.0 / bpm
    step_dur = beat_dur / 4.0
    total_steps = int(duration / step_dur)
    
    audio_data_left = []
    audio_data_right = []
    
    for step in range(total_steps):
        step_samples_l = [0] * int(SAMPLE_RATE * step_dur)
        step_samples_r = [0] * int(SAMPLE_RATE * step_dur)
        
        # Bassline
        b_note = base_pattern[step % len(base_pattern)]
        if b_note != 0:
            b_wave = generate_square_wave(get_freq(b_note), step_dur, vol=0.6 * intensity, decay=True)
            for i in range(len(step_samples_l)):
                step_samples_l[i] += int(b_wave[i] * 0.8)
                step_samples_r[i] += int(b_wave[i] * 0.4)
                
        # Arpeggio Melody
        if step >= 16 or is_boss:
            a_note = arpeggio_pattern[step % len(arpeggio_pattern)]
            a_wave = generate_square_wave(get_freq(a_note), step_dur, vol=0.3 * intensity, decay=not is_boss)
            for i in range(len(step_samples_l)):
                step_samples_l[i] += int(a_wave[i] * 0.3)
                step_samples_r[i] += int(a_wave[i] * 0.9)

        # Drums
        if step % (8 // complexity) == 0:
            k_wave = generate_square_wave(get_freq('C2') / 2, step_dur, vol=0.8 * intensity, decay=True)
            for i in range(len(step_samples_l)):
                step_samples_l[i] += k_wave[i]
                step_samples_r[i] += k_wave[i]
        elif step % 8 == 4 and complexity > 1:
            s_wave = generate_noise(step_dur, vol=0.6 * intensity)
            for i in range(len(step_samples_l)):
                step_samples_l[i] += s_wave[i]
                step_samples_r[i] += s_wave[i]
        elif is_boss and step % 2 == 0:
            # intense hihat for boss
            hh_wave = generate_noise(step_dur*0.5, vol=0.3 * intensity)
            for i in range(len(hh_wave)):
                step_samples_l[i] += hh_wave[i]
                step_samples_r[i] += hh_wave[i]
        
        audio_data_left.extend(step_samples_l)
        audio_data_right.extend(step_samples_r)

    # Output
    final_audio = []
    for l, r in zip(audio_data_left, audio_data_right):
        l = max(-32768, min(32767, l))
        r = max(-32768, min(32767, r))
        final_audio.append(struct.pack('<h', l))
        final_audio.append(struct.pack('<h', r))

    with wave.open(filename, 'w') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(b''.join(final_audio))
    print(f"Wrote {filename} successfully.")

# Stage 1: Standard minor penta, medium tempo
write_wav('public/assets/stage1.wav', bpm=130, duration=16, complexity=1, intensity=0.8,
    base_pattern=['C2', 0, 'C3', 0, 'C2', 0, 'Eb2', 'F2'] * 2,
    arpeggio_pattern=['C4', 'Eb4', 'G4', 'C5', 'G4', 'Eb4', 'C4', 'G3'])

# Stage 2: Faster, more complex drums, different base
write_wav('public/assets/stage2.wav', bpm=150, duration=16, complexity=2, intensity=0.9,
    base_pattern=['D2', 'D2', 'F2', 0, 'G2', 'F2', 'D2', 0],
    arpeggio_pattern=['D4', 'F4', 'A4', 'D5', 'A4', 'F4'] + ['C4', 'E4'])

# Stage 3: Intense, fast, strange scale
write_wav('public/assets/stage3.wav', bpm=170, duration=16, complexity=2, intensity=1.0,
    base_pattern=['Eb2', 0, 'Eb2', 'Gb2', 'Bb2', 0, 'Gb2', 'F2'],
    arpeggio_pattern=['Eb4', 'Gb4', 'Bb4', 'Eb5', 'Db5', 'Bb4', 'Gb4', 'Eb4'])

# Boss: Very intense, chaotic
write_wav('public/assets/boss.wav', bpm=180, duration=16, complexity=4, intensity=1.2, is_boss=True,
    base_pattern=['C2', 'Eb2', 'Gb2', 'A2'],
    arpeggio_pattern=['C5', 'A4', 'Gb4', 'Eb4', 'C4', 'Eb4', 'Gb4', 'A4'])
