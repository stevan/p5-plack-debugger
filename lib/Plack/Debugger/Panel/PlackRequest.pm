package Plack::Debugger::Panel::PlackRequest;

use strict;
use warnings;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Plack Request';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        $self->set_result([ 
            map { 
                $_ => (ref $env->{ $_ } && (ref $env->{ $_ } eq 'ARRAY' || ref $env->{ $_ } eq 'HASH')
                        ? $env->{ $_ }       # pass-through to JSON
                        : (''.$env->{ $_ })) # stringify it
            } sort keys %$env # sorting keys creates predictable ordering ...
        ]);
    };

    $class->SUPER::new( \%args );
}

1;

__END__