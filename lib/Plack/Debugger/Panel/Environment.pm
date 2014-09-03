package Plack::Debugger::Panel::Environment;

use strict;
use warnings;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Environment';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        # sorting keys creates predictable ordering ...
        $self->set_result([ map { $_ => $ENV{ $_ } } sort keys %ENV ]);
    };

    $class->SUPER::new( \%args );
}

1;

__END__