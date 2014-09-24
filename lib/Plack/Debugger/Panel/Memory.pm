package Plack::Debugger::Panel::Memory;

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Memory Usage';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        $self->stash( $self->current_memory );
    };

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;
        
        my $before = $self->stash;
        my $after  = $self->current_memory;

        $self->set_subtitle( $self->format_memory( $after ) );
        $self->set_result([
            'Before' => $self->format_memory( $before ),
            'After'  => $self->format_memory( $after  ),
            'Diff'   => $self->format_memory( $after - $before )
        ]);
    };

    $class->SUPER::new( \%args );
}

sub format_memory {
    my ($self, $memory) = @_;
    1 while $memory =~ s/^([-+]?\d+)(\d{3})/$1,$2/;
    return "$memory KB";
}

sub current_memory {
    my $self = shift;
    my $out  = `ps -o rss= -p $$`;
    $out =~ s/^\s*|\s*$//gs;
    $out;
}

1;

__END__

=pod

=head1 NAME

Plack::Debugger::Panel::Memroy - Debug panel for watching memory usage

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut